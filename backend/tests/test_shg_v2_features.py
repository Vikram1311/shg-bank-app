"""
SHG BANK iteration 2 new feature tests:
- Guarantor system (eligible list, block on apply, 75% release)
- Member self-deposit savings
- Admin edit/delete savings, edit contributions, edit loans
- Interest auto-distribution to savings (idempotent)
- Settings.maxLoanAmountWithGuarantor
- Old loan running/closed variants
- Authorization checks for new endpoints
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
REKHA = ("7678253940", "3940")


def H(t):
    return {"Authorization": f"Bearer {t}"}


# module-level shared state
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


@pytest.fixture(scope="session")
def rekha():
    t, i = login(*REKHA)
    return {"token": t, "id": i}


# ----- Helper: clear any active loans for a member to ensure clean test slate -----

def _delete_active_loans(admin_token, member_id):
    loans = requests.get(f"{API}/loans?memberId={member_id}", headers=H(admin_token), timeout=15).json()
    for l in loans:
        if l["status"] in ("active", "pending"):
            requests.delete(f"{API}/loans/{l['id']}", headers=H(admin_token), timeout=15)


@pytest.fixture(scope="session", autouse=True)
def clean_state(admin, nisha, meena, rekha):
    """Clean active loans for involved members so guarantor flow is deterministic."""
    for mid in (nisha["id"], meena["id"], rekha["id"]):
        _delete_active_loans(admin["token"], mid)
    yield


# ==================== Settings ====================

class TestSettingsGuarantor:
    def test_max_loan_with_guarantor_field(self):
        r = requests.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert "maxLoanAmountWithGuarantor" in s
        assert s["maxLoanAmountWithGuarantor"] == 30000


# ==================== Eligible Guarantors ====================

class TestEligibleGuarantors:
    def test_eligible_excludes_self_and_admin(self, nisha, admin):
        r = requests.get(f"{API}/loans/eligible-guarantors/{nisha['id']}", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200
        eligible = r.json()
        assert isinstance(eligible, list)
        ids = {e["id"] for e in eligible}
        assert nisha["id"] not in ids, "Self should be excluded"
        assert admin["id"] not in ids, "Admin should be excluded"
        # Each has id, name, mobile
        if eligible:
            for k in ("id", "name", "mobile"):
                assert k in eligible[0]

    def test_eligible_requires_auth(self, nisha):
        r = requests.get(f"{API}/loans/eligible-guarantors/{nisha['id']}", timeout=15)
        assert r.status_code == 401


# ==================== Guarantor Loan flow ====================

class TestGuarantorLoanFlow:
    def test_loan_above_15k_requires_guarantor(self, nisha):
        r = requests.post(f"{API}/loans/apply", headers=H(nisha["token"]), json={
            "memberId": nisha["id"], "amount": 20000, "months": 3
        }, timeout=15)
        assert r.status_code == 400
        assert "guarantor" in r.text.lower()

    def test_loan_above_30k_rejected(self, nisha, meena):
        r = requests.post(f"{API}/loans/apply", headers=H(nisha["token"]), json={
            "memberId": nisha["id"], "amount": 35000, "months": 3, "guarantorId": meena["id"]
        }, timeout=15)
        assert r.status_code == 400

    def test_self_guarantor_rejected(self, nisha):
        r = requests.post(f"{API}/loans/apply", headers=H(nisha["token"]), json={
            "memberId": nisha["id"], "amount": 20000, "months": 3, "guarantorId": nisha["id"]
        }, timeout=15)
        assert r.status_code == 400

    def test_loan_with_guarantor_success(self, nisha, meena, admin):
        # MEENA acts as guarantor for NISHA's 20000 loan over 4 months
        r = requests.post(f"{API}/loans/apply", headers=H(nisha["token"]), json={
            "memberId": nisha["id"], "amount": 20000, "months": 4, "guarantorId": meena["id"]
        }, timeout=15)
        assert r.status_code == 200, r.text
        loan = r.json()
        assert loan["guarantorId"] == meena["id"]
        assert loan["guarantorName"] == "MEENA"
        # approve so it's active
        ap = requests.post(f"{API}/loans/{loan['id']}/approve", headers=H(admin["token"]), timeout=15)
        assert ap.status_code == 200
        SHARED["loan_state"] = {"loan_id": loan["id"], "totalPayable": loan["totalPayable"], "months": loan["months"]}

    def test_meena_excluded_from_eligible(self, nisha, meena):
        # Now MEENA is blocking (0% paid) -> should be excluded
        r = requests.get(f"{API}/loans/eligible-guarantors/{nisha['id']}", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 200
        ids = {e["id"] for e in r.json()}
        assert meena["id"] not in ids, "MEENA should be excluded as she's guaranteeing active loan <75% paid"

    def test_meena_blocked_from_new_loan(self, meena):
        r = requests.post(f"{API}/loans/apply", headers=H(meena["token"]), json={
            "memberId": meena["id"], "amount": 5000, "months": 2
        }, timeout=15)
        assert r.status_code == 400
        assert "guarantor" in r.text.lower()

    def test_meena_stats_show_block_reason(self, meena):
        r = requests.get(f"{API}/members/{meena['id']}/stats", headers=H(meena["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["canApplyLoan"] is False
        assert d["blockReason"] == "guarantor_block_75"

    def test_pay_75_percent_releases_meena(self, admin, meena, nisha):
        # Pay 3 of 4 EMIs (75%)
        loan_id = SHARED["loan_state"]["loan_id"]
        today = datetime.now().strftime("%Y-%m-%d")
        for emi_num in (1, 2, 3):
            p = requests.post(f"{API}/loans/emi-pay", headers=H(admin["token"]), json={
                "loanId": loan_id, "emiNumber": emi_num, "paidDate": today, "applyPenalty": False
            }, timeout=15)
            assert p.status_code == 200, p.text
        # Verify percentage >= 75%
        loans = requests.get(f"{API}/loans?memberId={nisha['id']}", headers=H(admin["token"]), timeout=15).json()
        target = next(l for l in loans if l["id"] == loan_id)
        paid_sum = sum(e["amount"] for e in target["emiHistory"] if e["status"] == "paid")
        assert (paid_sum / target["totalPayable"]) >= 0.75
        # MEENA should now appear in eligible list
        r = requests.get(f"{API}/loans/eligible-guarantors/{nisha['id']}", headers=H(nisha["token"]), timeout=15)
        ids = {e["id"] for e in r.json()}
        assert meena["id"] in ids, "MEENA should be eligible again after 75% paid"
        # MEENA's stats should now show canApplyLoan True
        s = requests.get(f"{API}/members/{meena['id']}/stats", headers=H(meena["token"]), timeout=15).json()
        assert s["canApplyLoan"] is True
        assert s["blockReason"] is None


# ==================== Self-deposit savings ====================

class TestMemberSelfSavings:
    def test_member_self_deposit_success(self, rekha):
        r = requests.post(f"{API}/savings/deposit", headers=H(rekha["token"]), json={
            "memberId": rekha["id"], "amount": 250, "date": "2026-01-05", "description": "TEST_self"
        }, timeout=15)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["type"] == "deposit"
        assert t["amount"] == 250
        assert t["memberId"] == rekha["id"]
        SHARED["savings_state"] = {"txn_id": t["id"], "member_id": rekha["id"]}

    def test_member_cannot_deposit_for_other(self, nisha, rekha):
        r = requests.post(f"{API}/savings/deposit", headers=H(nisha["token"]), json={
            "memberId": rekha["id"], "amount": 100, "date": "2026-01-05"
        }, timeout=15)
        assert r.status_code == 403

    def test_balance_self(self, rekha):
        r = requests.get(f"{API}/savings/balance/{rekha['id']}", headers=H(rekha["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["memberId"] == rekha["id"]
        assert isinstance(d["balance"], (int, float))
        assert d["balance"] >= 250

    def test_balance_other_blocked(self, nisha, rekha):
        r = requests.get(f"{API}/savings/balance/{rekha['id']}", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 403

    def test_balance_admin_can_view_other(self, admin, rekha):
        r = requests.get(f"{API}/savings/balance/{rekha['id']}", headers=H(admin["token"]), timeout=15)
        assert r.status_code == 200


# ==================== Admin edit/delete savings ====================

class TestSavingsEditDelete:
    def test_edit_savings_admin(self, admin):
        txn_id = SHARED["savings_state"]["txn_id"]
        r = requests.put(f"{API}/savings/{txn_id}", headers=H(admin["token"]), json={
            "amount": 300, "description": "TEST_edited"
        }, timeout=15)
        assert r.status_code == 200
        t = r.json()
        assert t["amount"] == 300
        assert t["description"] == "TEST_edited"

    def test_edit_savings_non_admin_blocked(self, rekha):
        txn_id = SHARED["savings_state"]["txn_id"]
        r = requests.put(f"{API}/savings/{txn_id}", headers=H(rekha["token"]), json={"amount": 999}, timeout=15)
        assert r.status_code == 403

    def test_delete_savings_non_admin_blocked(self, rekha):
        txn_id = SHARED["savings_state"]["txn_id"]
        r = requests.delete(f"{API}/savings/{txn_id}", headers=H(rekha["token"]), timeout=15)
        assert r.status_code == 403

    def test_delete_savings_admin(self, admin, rekha):
        txn_id = SHARED["savings_state"]["txn_id"]
        r = requests.delete(f"{API}/savings/{txn_id}", headers=H(admin["token"]), timeout=15)
        assert r.status_code == 200
        # Verify by GET savings list
        s = requests.get(f"{API}/savings?memberId={rekha['id']}", headers=H(admin["token"]), timeout=15).json()
        assert all(t["id"] != txn_id for t in s), "Deleted txn still present"


# ==================== Edit Contribution ====================

class TestContributionEdit:
    def test_edit_contribution_admin(self, admin, nisha):
        # find any existing contribution for NISHA
        c_list = requests.get(f"{API}/contributions?memberId={nisha['id']}", headers=H(admin["token"]), timeout=15).json()
        if not c_list:
            # create one
            r = requests.post(f"{API}/contributions", headers=H(admin["token"]), json={
                "memberId": nisha["id"], "month": "2026-01", "paidDate": "2026-01-05", "applyPenalty": False
            }, timeout=15)
            assert r.status_code == 200
            c_list = [r.json()]
        contrib_id = c_list[0]["id"]
        r = requests.put(f"{API}/contributions/{contrib_id}", headers=H(admin["token"]), json={
            "amount": 1234, "penalty": 50
        }, timeout=15)
        assert r.status_code == 200
        c = r.json()
        assert c["amount"] == 1234
        assert c["penalty"] == 50
        SHARED["contrib_state"] = {"contrib_id": contrib_id}

    def test_edit_contribution_non_admin_blocked(self, nisha):
        contrib_id = SHARED["contrib_state"]["contrib_id"]
        r = requests.put(f"{API}/contributions/{contrib_id}", headers=H(nisha["token"]), json={"amount": 1}, timeout=15)
        assert r.status_code == 403


# ==================== Edit Loan ====================

class TestLoanEdit:
    def test_edit_loan_admin(self, admin):
        loan_id = SHARED["loan_state"]["loan_id"]
        r = requests.put(f"{API}/loans/{loan_id}", headers=H(admin["token"]), json={
            "includeInApp": False
        }, timeout=15)
        assert r.status_code == 200
        l = r.json()
        assert l["includeInApp"] is False
        # restore
        requests.put(f"{API}/loans/{loan_id}", headers=H(admin["token"]), json={"includeInApp": True}, timeout=15)

    def test_edit_loan_non_admin_blocked(self, nisha):
        loan_id = SHARED["loan_state"]["loan_id"]
        r = requests.put(f"{API}/loans/{loan_id}", headers=H(nisha["token"]), json={"includeInApp": False}, timeout=15)
        assert r.status_code == 403


# ==================== Distribute Interest ====================

class TestDistributeInterest:
    def test_distribute_non_admin_blocked(self, nisha):
        r = requests.post(f"{API}/savings/distribute-interest", headers=H(nisha["token"]), timeout=15)
        assert r.status_code == 403

    def test_distribute_admin_credits_interest(self, admin):
        r = requests.post(f"{API}/savings/distribute-interest", headers=H(admin["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "transferred" in d
        assert "totalMembers" in d
        # Should have credited at least 1 member (NISHA has paid loans w/ interest)
        first_run_count = d["totalMembers"]
        SHARED["interest_first_run"] = first_run_count

    def test_distribute_idempotent(self, admin):
        r = requests.post(f"{API}/savings/distribute-interest", headers=H(admin["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Second run should NOT double-credit (totalMembers should be 0 or each delta ~0)
        # Each transferred entry's amount should be near zero
        for t in d["transferred"]:
            assert t["amount"] <= 0.5, f"Second run double-credited: {t}"

    def test_interest_credit_appears_in_savings(self, admin, nisha):
        s = requests.get(f"{API}/savings?memberId={nisha['id']}", headers=H(admin["token"]), timeout=15).json()
        interest_entries = [t for t in s if t.get("description", "").startswith("Interest auto-credit")]
        # NISHA had loan with totalInterest >0 and contributions -> should get a share
        assert len(interest_entries) >= 1, "Expected at least 1 Interest auto-credit entry for NISHA"


# ==================== Old Loan variants ====================

class TestOldLoan:
    def test_old_loan_running(self, admin, rekha):
        r = requests.post(f"{API}/loans/old", headers=H(admin["token"]), json={
            "memberId": rekha["id"], "amount": 5000, "openingDate": "2025-06-10",
            "months": 3, "interestRate": 2, "includeInterest": True, "includeInApp": True
        }, timeout=15)
        assert r.status_code == 200
        l = r.json()
        assert l["isOldLoan"] is True
        assert l["status"] == "active"
        assert l["remainingAmount"] > 0
        # cleanup
        requests.delete(f"{API}/loans/{l['id']}", headers=H(admin["token"]), timeout=15)

    def test_old_loan_closed(self, admin, rekha):
        r = requests.post(f"{API}/loans/old", headers=H(admin["token"]), json={
            "memberId": rekha["id"], "amount": 5000, "openingDate": "2025-01-10",
            "closingDate": "2025-04-10", "months": 3, "interestRate": 2,
            "includeInterest": True, "includeInApp": True
        }, timeout=15)
        assert r.status_code == 200
        l = r.json()
        assert l["isOldLoan"] is True
        assert l["status"] == "completed"
        assert l["remainingAmount"] == 0
        # all EMIs should be paid
        assert all(e["status"] == "paid" for e in l["emiHistory"])
        requests.delete(f"{API}/loans/{l['id']}", headers=H(admin["token"]), timeout=15)

    def test_old_loan_non_admin_blocked(self, nisha, rekha):
        r = requests.post(f"{API}/loans/old", headers=H(nisha["token"]), json={
            "memberId": rekha["id"], "amount": 1000, "openingDate": "2025-01-10",
            "months": 1
        }, timeout=15)
        assert r.status_code == 403
