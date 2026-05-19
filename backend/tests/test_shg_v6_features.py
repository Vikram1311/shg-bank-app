"""
SHG BANK Iteration 6 - Backend tests
Covers:
- Settings: penaltyStartDate, savingsInterestRate
- Dashboard stats: pendingSavingsCount/Amount, totalPersonalLoans
- Pending-penalty respects penaltyStartDate
- Personal loans (admin-only, isPersonal=True, includeInApp=False, notification)
- Personal loan interest excluded from interestShare / dashboard totalInterest
- distribute-savings-interest (admin only, idempotent, skip zero-balance, notifications, monthlyRate)
"""
import os
import time
import pytest
import requests
from datetime import datetime

def _load_frontend_env_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for ln in f:
                    if ln.startswith("REACT_APP_BACKEND_URL="):
                        url = ln.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return url.rstrip("/")


BASE_URL = _load_frontend_env_url()
API = f"{BASE_URL}/api"

ADMIN_MOBILE, ADMIN_PASS = "9315341037", "1311"
NISHA_MOBILE, NISHA_PASS = "9711321568", "1568"
MEENA_MOBILE, MEENA_PASS = "9289137685", "7685"


# -------------------- fixtures --------------------
def _login(mobile, password):
    r = requests.post(f"{API}/auth/login", json={"mobile": mobile, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {mobile}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_MOBILE, ADMIN_PASS)


@pytest.fixture(scope="module")
def nisha():
    return _login(NISHA_MOBILE, NISHA_PASS)


@pytest.fixture(scope="module")
def meena():
    return _login(MEENA_MOBILE, MEENA_PASS)


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_h(admin):
    return H(admin["token"])


@pytest.fixture(scope="module")
def original_settings(admin_h):
    """Snapshot settings before tests, restore at module end."""
    r = requests.get(f"{API}/settings", timeout=15)
    assert r.status_code == 200
    snap = r.json()
    yield snap
    # restore key values that tests mutate
    requests.put(
        f"{API}/settings",
        headers=admin_h,
        json={
            "penaltyStartDate": snap.get("penaltyStartDate", "2026-06-10"),
            "savingsInterestRate": snap.get("savingsInterestRate", 7.25),
        },
        timeout=15,
    )


# ============================================================
# 1. SETTINGS
# ============================================================
class TestSettings:
    def test_settings_has_new_fields(self, original_settings):
        s = original_settings
        assert "penaltyStartDate" in s, "Missing penaltyStartDate"
        assert "savingsInterestRate" in s, "Missing savingsInterestRate"
        # defaults expected per spec
        assert s["penaltyStartDate"] == "2026-06-10", f"penaltyStartDate default expected '2026-06-10', got {s['penaltyStartDate']}"
        assert abs(float(s["savingsInterestRate"]) - 7.25) < 0.001, f"savingsInterestRate default expected 7.25, got {s['savingsInterestRate']}"

    def test_update_settings_persists(self, admin_h, original_settings):
        r = requests.put(
            f"{API}/settings",
            headers=admin_h,
            json={"penaltyStartDate": "2026-04-15", "savingsInterestRate": 8.5},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["penaltyStartDate"] == "2026-04-15"
        assert abs(float(data["savingsInterestRate"]) - 8.5) < 0.001

        # GET to verify persistence
        r2 = requests.get(f"{API}/settings", timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["penaltyStartDate"] == "2026-04-15"
        assert abs(float(d2["savingsInterestRate"]) - 8.5) < 0.001

        # restore for downstream tests
        requests.put(
            f"{API}/settings",
            headers=admin_h,
            json={
                "penaltyStartDate": original_settings.get("penaltyStartDate", "2026-06-10"),
                "savingsInterestRate": original_settings.get("savingsInterestRate", 7.25),
            },
            timeout=15,
        )


# ============================================================
# 2. DASHBOARD STATS - new fields
# ============================================================
class TestDashboardStats:
    def test_dashboard_has_new_fields(self, admin_h):
        r = requests.get(f"{API}/dashboard/stats", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("pendingSavingsCount", "pendingSavingsAmount", "totalPersonalLoans"):
            assert k in d, f"missing {k} in dashboard/stats"
        assert isinstance(d["pendingSavingsCount"], int)
        assert isinstance(d["pendingSavingsAmount"], (int, float))
        assert isinstance(d["totalPersonalLoans"], (int, float))

    def test_pending_savings_count_increments_then_decrements(self, admin_h, nisha):
        # initial counts
        s0 = requests.get(f"{API}/dashboard/stats", headers=admin_h, timeout=15).json()
        base_count = s0["pendingSavingsCount"]
        base_amount = s0["pendingSavingsAmount"]

        # member self-deposit -> pending
        tok = H(nisha["token"])
        amt = 123.0
        r = requests.post(
            f"{API}/savings/deposit",
            headers=tok,
            json={"memberId": nisha["member"]["id"], "amount": amt, "date": datetime.now().date().isoformat(), "description": "TEST_v6 pending"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        txn = r.json()
        assert txn["status"] == "pending", f"member self-deposit must be pending, got {txn['status']}"
        txn_id = txn["id"]

        s1 = requests.get(f"{API}/dashboard/stats", headers=admin_h, timeout=15).json()
        assert s1["pendingSavingsCount"] == base_count + 1, f"expected {base_count+1}, got {s1['pendingSavingsCount']}"
        assert abs(s1["pendingSavingsAmount"] - (base_amount + amt)) < 0.01

        # admin approves
        r2 = requests.post(f"{API}/savings/{txn_id}/approve", headers=admin_h, timeout=15)
        assert r2.status_code == 200, r2.text

        s2 = requests.get(f"{API}/dashboard/stats", headers=admin_h, timeout=15).json()
        assert s2["pendingSavingsCount"] == base_count, f"expected back to {base_count}, got {s2['pendingSavingsCount']}"
        assert abs(s2["pendingSavingsAmount"] - base_amount) < 0.01


# ============================================================
# 3. PENDING PENALTY respects penaltyStartDate
# ============================================================
class TestPendingPenalty:
    def test_pending_penalty_zero_when_start_in_future(self, admin_h, nisha):
        # Ensure penaltyStartDate is future (default 2026-06-10) - reset to default
        requests.put(f"{API}/settings", headers=admin_h, json={"penaltyStartDate": "2026-06-10"}, timeout=15)
        mid = nisha["member"]["id"]
        r = requests.get(f"{API}/members/{mid}/stats", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # Current sys date should be < 2026-06-10
        assert d["pendingPenalty"] == 0, f"pendingPenalty must be 0 when penaltyStartDate in future, got {d['pendingPenalty']}"

    def test_pending_penalty_nonzero_when_start_in_past(self, admin_h, nisha):
        # Move start to past
        requests.put(f"{API}/settings", headers=admin_h, json={"penaltyStartDate": "2026-03-10"}, timeout=15)
        mid = nisha["member"]["id"]
        r = requests.get(f"{API}/members/{mid}/stats", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # Should be > 0 because there are unpaid months between 2026-03 and 2026-05 for non-admin
        assert d["pendingPenalty"] > 0, f"Expected pendingPenalty > 0 with past penaltyStartDate, got {d['pendingPenalty']}"

    def test_restore_penalty_start(self, admin_h):
        # restore to spec default
        r = requests.put(f"{API}/settings", headers=admin_h, json={"penaltyStartDate": "2026-06-10"}, timeout=15)
        assert r.status_code == 200


# ============================================================
# 4. PERSONAL LOANS
# ============================================================
class TestPersonalLoans:
    @pytest.fixture(scope="class")
    def created_personal_loan(self, admin_h, meena):
        payload = {
            "memberId": meena["member"]["id"],
            "amount": 5000,
            "months": 5,
            "interestRate": 3,
            "openingDate": "2026-05-01",
            "description": "TEST_v6 personal loan",
        }
        r = requests.post(f"{API}/personal-loans", headers=admin_h, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_personal_loan_created_correctly(self, created_personal_loan):
        loan = created_personal_loan
        assert loan["isPersonal"] is True
        assert loan["includeInApp"] is False
        assert loan["status"] == "active"
        assert loan["amount"] == 5000
        assert loan["months"] == 5
        assert isinstance(loan.get("emiHistory"), list) and len(loan["emiHistory"]) == 5
        # totalInterest should be > 0
        assert loan["totalInterest"] > 0

    def test_personal_loan_completed_if_closingDate(self, admin_h, meena):
        payload = {
            "memberId": meena["member"]["id"],
            "amount": 1000,
            "months": 2,
            "interestRate": 2,
            "openingDate": "2026-04-01",
            "closingDate": "2026-05-01",
            "description": "TEST_v6 closed personal",
        }
        r = requests.post(f"{API}/personal-loans", headers=admin_h, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        loan = r.json()
        assert loan["status"] == "completed"
        assert all(e["status"] == "paid" for e in loan["emiHistory"])
        # cleanup
        requests.delete(f"{API}/loans/{loan['id']}", headers=admin_h, timeout=15)

    def test_personal_loan_fires_notification(self, created_personal_loan, meena):
        loan_id = created_personal_loan["id"]
        # tiny grace for write
        time.sleep(0.4)
        r = requests.get(f"{API}/notifications", headers=H(meena["token"]), timeout=15)
        assert r.status_code == 200, r.text
        notifs = r.json()
        matching = [n for n in notifs if n.get("type") == "personal_loan" and n.get("referenceId") == loan_id]
        assert len(matching) >= 1, f"No personal_loan notification with referenceId={loan_id}. Notifications: {[(n.get('type'), n.get('referenceId')) for n in notifs]}"

    def test_personal_loan_non_admin_forbidden(self, nisha, meena):
        payload = {
            "memberId": meena["member"]["id"],
            "amount": 100,
            "months": 1,
            "interestRate": 2,
            "openingDate": "2026-05-01",
        }
        r = requests.post(f"{API}/personal-loans", headers=H(nisha["token"]), json=payload, timeout=15)
        assert r.status_code == 403, f"Non-admin should get 403, got {r.status_code}"

    def test_personal_loan_invalid_member_404(self, admin_h):
        payload = {
            "memberId": "non-existent-id-xyz",
            "amount": 100,
            "months": 1,
            "interestRate": 2,
            "openingDate": "2026-05-01",
        }
        r = requests.post(f"{API}/personal-loans", headers=admin_h, json=payload, timeout=15)
        assert r.status_code == 404, f"Invalid member should get 404, got {r.status_code}"

    def test_loans_list_includes_personal(self, admin_h, created_personal_loan):
        r = requests.get(f"{API}/loans", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        loans = r.json()
        ids = [l["id"] for l in loans]
        assert created_personal_loan["id"] in ids, "Personal loan not returned by GET /loans"
        # field present
        for l in loans:
            assert "isPersonal" in l

    def test_dashboard_totalPersonalLoans_increased(self, admin_h, created_personal_loan):
        r = requests.get(f"{API}/dashboard/stats", headers=admin_h, timeout=15)
        d = r.json()
        # at least the 5000 we just made should be in the total
        assert d["totalPersonalLoans"] >= 5000

    def test_dashboard_totalInterest_excludes_personal(self, admin_h, created_personal_loan):
        # totalInterest is sum of group loans only. With no group loans seeded, must be 0.
        r = requests.get(f"{API}/loans", headers=admin_h, timeout=15)
        loans = r.json()
        group_interest = sum(l.get("totalInterest", 0) for l in loans if not l.get("isPersonal") and l.get("includeInApp", True) and l.get("status") in ("active", "completed"))
        d = requests.get(f"{API}/dashboard/stats", headers=admin_h, timeout=15).json()
        # totalInterest in dashboard should match group_interest (excludes personal even though personal has interest)
        assert abs(d["totalInterest"] - group_interest) < 0.01, f"dashboard totalInterest {d['totalInterest']} != group_interest {group_interest}"

    def test_member_stats_interestShare_excludes_personal(self, admin_h, meena, created_personal_loan):
        # Personal loan exists with interest > 0 for MEENA but member-stats interestShare should NOT include it.
        # Compute via GET /loans, then check that stats interestShare equals (share_contrib/total_all_contribs)*group_interest
        mid = meena["member"]["id"]
        r = requests.get(f"{API}/members/{mid}/stats", headers=H(meena["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # Without any group contributions / group loans, interestShare should be 0.
        loans = requests.get(f"{API}/loans", headers=admin_h, timeout=15).json()
        group_loans_interest = sum(l.get("totalInterest", 0) for l in loans if not l.get("isPersonal") and l.get("includeInApp", True) and l.get("status") in ("active", "completed"))
        if group_loans_interest == 0:
            assert d["interestShare"] == 0, f"interestShare should be 0 since no group loans, got {d['interestShare']}"
        # In any case, member's interestShare must not be >= personal loan interest
        assert d["interestShare"] < created_personal_loan["totalInterest"] or group_loans_interest > 0

    def test_cleanup_personal_loan(self, admin_h, created_personal_loan):
        r = requests.delete(f"{API}/loans/{created_personal_loan['id']}", headers=admin_h, timeout=15)
        assert r.status_code == 200


# ============================================================
# 5. DISTRIBUTE SAVINGS INTEREST
# ============================================================
class TestDistributeSavingsInterest:
    @pytest.fixture(scope="class")
    def seeded_balances(self, admin_h, nisha, meena):
        """Admin-creates approved deposits for NISHA (1000) and MEENA (0 balance)."""
        today = datetime.now().date().isoformat()
        # NISHA deposit (admin-created → approved)
        r1 = requests.post(
            f"{API}/savings/deposit",
            headers=admin_h,
            json={"memberId": nisha["member"]["id"], "amount": 1000, "date": today, "description": "TEST_v6 seed nisha"},
            timeout=15,
        )
        assert r1.status_code == 200
        assert r1.json()["status"] == "approved"
        nisha_txn_id = r1.json()["id"]
        # Note: MEENA gets nothing → balance 0 should be skipped
        yield {"nisha_txn_id": nisha_txn_id}
        # cleanup deposit
        requests.delete(f"{API}/savings/{nisha_txn_id}", headers=admin_h, timeout=15)

    def test_distribute_non_admin_forbidden(self, nisha):
        r = requests.post(f"{API}/savings/distribute-savings-interest", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 403

    def test_distribute_runs_and_returns_monthly_rate(self, admin_h, seeded_balances, nisha, meena):
        # clean any previous month interest txn for nisha first
        month_key = datetime.now().strftime("%Y-%m")
        # Capture balance BEFORE distribute so we can verify the interest amount precisely
        bal_before = requests.get(f"{API}/savings/balance/{nisha['member']['id']}", headers=admin_h, timeout=15).json()
        balance_before = bal_before.get("balance", 0)

        r = requests.post(f"{API}/savings/distribute-savings-interest", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "transferred" in d
        assert "monthlyRate" in d
        # 7.25/12 = 0.6042 (rounded to 4)
        expected = round(7.25 / 12, 4)
        assert abs(d["monthlyRate"] - expected) < 0.001, f"monthlyRate expected ~{expected}, got {d['monthlyRate']}"

        # Verify NISHA got credit and MEENA did NOT
        transferred = d["transferred"]
        nisha_entries = [t for t in transferred if t["memberId"] == nisha["member"]["id"]]
        meena_entries = [t for t in transferred if t["memberId"] == meena["member"]["id"]]
        assert len(nisha_entries) == 1, f"NISHA should receive interest, transferred={transferred}"
        expected_interest = round(balance_before * 7.25 / 12 / 100, 2)
        assert abs(nisha_entries[0]["amount"] - expected_interest) < 0.05, f"interest {nisha_entries[0]['amount']} != expected {expected_interest} on balance {balance_before}"
        assert len(meena_entries) == 0, f"MEENA balance=0, should be skipped, got {meena_entries}"

        # Verify transaction was created with the right description
        sv = requests.get(f"{API}/savings?memberId={nisha['member']['id']}", headers=admin_h, timeout=15).json()
        match = [t for t in sv if t.get("description") == f"Savings interest {month_key}"]
        assert len(match) >= 1, f"No savings txn with description 'Savings interest {month_key}'"

    def test_distribute_idempotent(self, admin_h, seeded_balances, nisha):
        # second call within same month — NISHA must NOT receive a second credit
        r = requests.post(f"{API}/savings/distribute-savings-interest", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        nisha_entries = [t for t in d["transferred"] if t["memberId"] == nisha["member"]["id"]]
        assert len(nisha_entries) == 0, f"Idempotency broken: nisha credited twice in same month: {nisha_entries}"

    def test_distribute_fires_notifications(self, admin_h, nisha):
        # check NISHA has a savings_interest notification
        time.sleep(0.4)
        notifs = requests.get(f"{API}/notifications", headers=H(nisha["token"]), timeout=15).json()
        matching = [n for n in notifs if n.get("type") == "savings_interest"]
        assert len(matching) >= 1, f"No savings_interest notification for NISHA. types: {[n.get('type') for n in notifs]}"

    def test_cleanup_interest_txn(self, admin_h, nisha):
        # Remove the savings interest deposit so subsequent runs are clean
        sv = requests.get(f"{API}/savings?memberId={nisha['member']['id']}", headers=admin_h, timeout=15).json()
        month_key = datetime.now().strftime("%Y-%m")
        for t in sv:
            if t.get("description") == f"Savings interest {month_key}":
                requests.delete(f"{API}/savings/{t['id']}", headers=admin_h, timeout=15)
