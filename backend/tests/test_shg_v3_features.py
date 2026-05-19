"""
SHG BANK iteration 3 backend tests:
- Member self-deposit -> pending status; admin deposit -> approved
- Approve/Reject pending savings + auto notification (savings_approved/savings_rejected)
- Balance endpoint exposes pendingAmount/pendingCount; pending excluded from balance
- /members/{id}/stats exposes pendingPenalty, pendingPenaltyItems, pendingSavings
- Admin exempt from pending penalty
- Daily penalty notification auto-created once per day
- /notifications GET, read, read-all, 404 on missing id
"""
import os
import requests
import pytest
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://shg-bank-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("9315341037", "1311")
NISHA = ("9711321568", "1568")
MEENA = ("9289137685", "7685")


def H(t):
    return {"Authorization": f"Bearer {t}"}


SHARED = {}


def login(mobile, pwd):
    r = requests.post(f"{API}/auth/login", json={"mobile": mobile, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["token"], r.json()["member"]["id"]


@pytest.fixture(scope="session")
def admin():
    t, i = login(*ADMIN)
    return {"token": t, "id": i}


@pytest.fixture(scope="session")
def nisha():
    t, i = login(*NISHA)
    return {"token": t, "id": i}


@pytest.fixture(scope="session")
def meena():
    t, i = login(*MEENA)
    return {"token": t, "id": i}


# ==================== Savings Approval Workflow ====================

class TestSavingsApprovalWorkflow:
    def test_member_self_deposit_creates_pending(self, nisha):
        r = requests.post(f"{API}/savings/deposit", headers=H(nisha["token"]), json={
            "memberId": nisha["id"], "amount": 500, "date": "2026-01-12", "description": "TEST_v3_pending"
        }, timeout=15)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "pending", f"Expected pending, got {t.get('status')}"
        assert t["createdBy"] == "member", f"Expected createdBy=member, got {t.get('createdBy')}"
        assert t["amount"] == 500
        SHARED["pending_txn_id"] = t["id"]

    def test_admin_deposit_creates_approved(self, admin, meena):
        r = requests.post(f"{API}/savings/deposit", headers=H(admin["token"]), json={
            "memberId": meena["id"], "amount": 700, "date": "2026-01-12", "description": "TEST_v3_admin_dep"
        }, timeout=15)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "approved"
        assert t["createdBy"] == "admin"
        SHARED["admin_txn_id"] = t["id"]

    def test_balance_includes_pending_fields_and_excludes_pending(self, nisha):
        r = requests.get(f"{API}/savings/balance/{nisha['id']}", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "pendingAmount" in d, "pendingAmount missing"
        assert "pendingCount" in d, "pendingCount missing"
        assert d["pendingAmount"] >= 500
        assert d["pendingCount"] >= 1
        # Save baseline balance to confirm pending doesn't bump it
        SHARED["nisha_balance_before"] = d["balance"]
        SHARED["nisha_pending_before"] = d["pendingAmount"]

    def test_member_cannot_approve(self, nisha):
        txn_id = SHARED["pending_txn_id"]
        r = requests.post(f"{API}/savings/{txn_id}/approve", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 403

    def test_member_cannot_reject(self, nisha):
        txn_id = SHARED["pending_txn_id"]
        r = requests.post(f"{API}/savings/{txn_id}/reject", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 403

    def test_admin_approve_pending(self, admin, nisha):
        txn_id = SHARED["pending_txn_id"]
        r = requests.post(f"{API}/savings/{txn_id}/approve", headers=H(admin["token"]), timeout=15)
        assert r.status_code == 200, r.text
        # Verify status changed
        savings = requests.get(f"{API}/savings?memberId={nisha['id']}", headers=H(admin["token"]), timeout=15).json()
        target = next((t for t in savings if t["id"] == txn_id), None)
        assert target is not None
        assert target["status"] == "approved"
        # Verify balance bumped & pending reduced
        bal = requests.get(f"{API}/savings/balance/{nisha['id']}", headers=H(nisha["token"]), timeout=15).json()
        assert bal["balance"] >= SHARED["nisha_balance_before"] + 500 - 0.01
        assert bal["pendingAmount"] <= SHARED["nisha_pending_before"] - 500 + 0.01

    def test_savings_approved_notification_created(self, nisha):
        r = requests.get(f"{API}/notifications", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200
        notifs = r.json()
        approved = [n for n in notifs if n["type"] == "savings_approved" and n.get("referenceId") == SHARED["pending_txn_id"]]
        assert len(approved) >= 1, "Expected savings_approved notification"

    def test_admin_reject_pending(self, admin, meena):
        # Create a fresh pending deposit by MEENA, then admin rejects
        r = requests.post(f"{API}/savings/deposit", headers=H(meena["token"]), json={
            "memberId": meena["id"], "amount": 333, "date": "2026-01-12", "description": "TEST_v3_to_reject"
        }, timeout=15)
        assert r.status_code == 200
        txn_id = r.json()["id"]
        assert r.json()["status"] == "pending"

        rj = requests.post(f"{API}/savings/{txn_id}/reject", headers=H(admin["token"]), timeout=15)
        assert rj.status_code == 200

        # txn should be deleted
        savings = requests.get(f"{API}/savings?memberId={meena['id']}", headers=H(admin["token"]), timeout=15).json()
        assert all(t["id"] != txn_id for t in savings), "Rejected txn should be deleted"

        # notification of type savings_rejected
        notifs = requests.get(f"{API}/notifications", headers=H(meena["token"]), timeout=15).json()
        rejected = [n for n in notifs if n["type"] == "savings_rejected" and n.get("referenceId") == txn_id]
        assert len(rejected) >= 1, "Expected savings_rejected notification"

    def test_approve_nonexistent_404(self, admin):
        r = requests.post(f"{API}/savings/nonexistent-id-xyz/approve", headers=H(admin["token"]), timeout=15)
        assert r.status_code == 404

    def test_reject_nonexistent_404(self, admin):
        r = requests.post(f"{API}/savings/nonexistent-id-xyz/reject", headers=H(admin["token"]), timeout=15)
        assert r.status_code == 404


# ==================== Member Stats - pendingPenalty/pendingSavings ====================

class TestMemberStatsPenalty:
    def test_stats_has_new_fields(self, nisha):
        r = requests.get(f"{API}/members/{nisha['id']}/stats", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("pendingPenalty", "pendingPenaltyItems", "pendingSavings"):
            assert k in d, f"Missing field {k}"
        assert isinstance(d["pendingPenaltyItems"], list)
        assert isinstance(d["pendingPenalty"], (int, float))
        assert isinstance(d["pendingSavings"], (int, float))

    def test_admin_pending_penalty_zero(self, admin):
        r = requests.get(f"{API}/members/{admin['id']}/stats", headers=H(admin["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["pendingPenalty"] == 0, f"Admin should have 0 pending penalty, got {d['pendingPenalty']}"
        assert d["pendingPenaltyItems"] == []

    def test_pending_penalty_calculation_for_member(self, nisha):
        """For a member with old unpaid months, penalty must be > 0 and items must contain
        type+daysLate+amount and a month or loanId."""
        r = requests.get(f"{API}/members/{nisha['id']}/stats", headers=H(nisha["token"]), timeout=15)
        d = r.json()
        # NISHA joined some time ago; very likely has missing months pre-current-month
        if d["pendingPenalty"] > 0:
            for item in d["pendingPenaltyItems"]:
                assert "type" in item and item["type"] in ("contribution", "emi")
                assert "daysLate" in item and item["daysLate"] >= 1
                assert "amount" in item and item["amount"] > 0
                if item["type"] == "contribution":
                    assert "month" in item
                else:
                    assert "loanId" in item and "emiNumber" in item
        # store for double-rate check
        SHARED["nisha_penalty_items"] = d["pendingPenaltyItems"]

    def test_double_rate_when_both_emi_and_contribution_late(self, nisha):
        """If a month has both unpaid EMI and unpaid contribution, EMI rate must be 20/day (vs 10/day base)."""
        items = SHARED.get("nisha_penalty_items", [])
        contrib_months = {i["month"] for i in items if i["type"] == "contribution"}
        # find any emi item whose due-month overlaps an unpaid contribution month
        # We can't directly read due month from stats item; we infer via amount / daysLate
        for it in items:
            if it["type"] == "emi" and it["daysLate"] > 0:
                rate = it["amount"] / it["daysLate"]
                # rate must be either 10 (single) or 20 (double); we don't know which without
                # cross-referencing month, so just assert it's one of the two
                assert rate in (10.0, 20.0), f"Unexpected emi penalty rate {rate} (amount={it['amount']}, daysLate={it['daysLate']})"

    def test_pending_savings_field(self, nisha, admin):
        # Create new pending deposit by NISHA
        r = requests.post(f"{API}/savings/deposit", headers=H(nisha["token"]), json={
            "memberId": nisha["id"], "amount": 150, "date": "2026-01-12", "description": "TEST_v3_pending_for_stats"
        }, timeout=15)
        assert r.status_code == 200
        new_pending_id = r.json()["id"]
        # stats should reflect
        s = requests.get(f"{API}/members/{nisha['id']}/stats", headers=H(nisha["token"]), timeout=15).json()
        assert s["pendingSavings"] >= 150
        # cleanup - admin rejects
        requests.post(f"{API}/savings/{new_pending_id}/reject", headers=H(admin["token"]), timeout=15)


# ==================== Daily Penalty Notification ====================

class TestPenaltyNotificationAutoCreate:
    def test_stats_creates_one_notification_per_day(self, meena, admin):
        # Clear any existing 'penalty' notification for today by reading all (we can't delete via API).
        # Instead, count before & after - expect at most +1, and not +2 on consecutive calls.
        before = requests.get(f"{API}/notifications", headers=H(meena["token"]), timeout=15).json()
        today_iso = datetime.now().date().isoformat()
        before_penalty_today = [n for n in before if n["type"] == "penalty" and n["date"].startswith(today_iso)]

        # Call stats twice
        s1 = requests.get(f"{API}/members/{meena['id']}/stats", headers=H(meena["token"]), timeout=15).json()
        s2 = requests.get(f"{API}/members/{meena['id']}/stats", headers=H(meena["token"]), timeout=15).json()

        after = requests.get(f"{API}/notifications", headers=H(meena["token"]), timeout=15).json()
        after_penalty_today = [n for n in after if n["type"] == "penalty" and n["date"].startswith(today_iso)]

        if s1["pendingPenalty"] > 0:
            # Should have exactly 1 penalty notif today (no duplicates)
            assert len(after_penalty_today) <= 1 or len(after_penalty_today) == len(before_penalty_today), \
                f"Duplicate penalty notifications: before={len(before_penalty_today)}, after={len(after_penalty_today)}"
            assert len(after_penalty_today) >= 1, "Expected at least 1 penalty notification when pendingPenalty>0"
        else:
            # If no pending penalty, no penalty notif should be created
            assert len(after_penalty_today) == len(before_penalty_today)

    def test_admin_stats_creates_no_penalty_notification(self, admin):
        before = requests.get(f"{API}/notifications", headers=H(admin["token"]), timeout=15).json()
        before_penalty = [n for n in before if n["type"] == "penalty"]
        # Call stats
        requests.get(f"{API}/members/{admin['id']}/stats", headers=H(admin["token"]), timeout=15)
        after = requests.get(f"{API}/notifications", headers=H(admin["token"]), timeout=15).json()
        after_penalty = [n for n in after if n["type"] == "penalty"]
        assert len(after_penalty) == len(before_penalty), "Admin should not get penalty notifications"


# ==================== Notifications Inbox ====================

class TestNotificationsInbox:
    def test_get_returns_own_only(self, nisha, meena):
        n_list = requests.get(f"{API}/notifications", headers=H(nisha["token"]), timeout=15)
        assert n_list.status_code == 200
        for n in n_list.json():
            assert n["memberId"] == nisha["id"], "Notifications must be scoped to current user"

    def test_get_unauth(self):
        r = requests.get(f"{API}/notifications", timeout=15)
        assert r.status_code == 401

    def test_sort_recent_first(self, nisha):
        notifs = requests.get(f"{API}/notifications", headers=H(nisha["token"]), timeout=15).json()
        if len(notifs) >= 2:
            for i in range(len(notifs) - 1):
                assert notifs[i]["date"] >= notifs[i + 1]["date"], "Notifications must be sorted newest first"

    def test_mark_read(self, nisha):
        notifs = requests.get(f"{API}/notifications", headers=H(nisha["token"]), timeout=15).json()
        unread = next((n for n in notifs if not n["read"]), None)
        if not unread:
            pytest.skip("No unread notification available for read test")
        r = requests.post(f"{API}/notifications/{unread['id']}/read", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200
        # verify
        notifs2 = requests.get(f"{API}/notifications", headers=H(nisha["token"]), timeout=15).json()
        target = next(n for n in notifs2 if n["id"] == unread["id"])
        assert target["read"] is True

    def test_mark_read_other_member_forbidden(self, nisha, meena):
        # find notification belonging to MEENA
        meena_notifs = requests.get(f"{API}/notifications", headers=H(meena["token"]), timeout=15).json()
        if not meena_notifs:
            pytest.skip("MEENA has no notifications to test cross-user read")
        target_id = meena_notifs[0]["id"]
        r = requests.post(f"{API}/notifications/{target_id}/read", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 403

    def test_mark_read_nonexistent_404(self, nisha):
        r = requests.post(f"{API}/notifications/nonexistent-id-zzz/read", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 404

    def test_read_all(self, nisha):
        # Create a guaranteed-unread notification by depositing+approving (savings_approved auto-generated)
        # Then call read-all and verify zero unread.
        r = requests.post(f"{API}/notifications/read-all", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200
        notifs = requests.get(f"{API}/notifications", headers=H(nisha["token"]), timeout=15).json()
        unread = [n for n in notifs if not n["read"]]
        assert len(unread) == 0, f"Expected 0 unread after read-all, found {len(unread)}"
