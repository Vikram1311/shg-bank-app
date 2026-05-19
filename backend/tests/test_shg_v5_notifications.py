"""
Iter5 backend tests - SHG BANK notifications + admin clear-transactions + manual penalty endpoints.
"""
import os
import time
import uuid
from datetime import datetime

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_MOBILE = "9315341037"
ADMIN_PASSWORD = "1311"
NISHA_MOBILE = "9711321568"
NISHA_PASSWORD = "1568"
MEENA_MOBILE = "9289137685"
MEENA_PASSWORD = "7685"


# -------- helpers --------
def _login(mobile, password):
    r = requests.post(f"{API}/auth/login", json={"mobile": mobile, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.text}"
    j = r.json()
    return j["token"], j["member"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _today():
    return datetime.now().date().isoformat()


# -------- fixtures --------
@pytest.fixture(scope="module")
def admin():
    tok, m = _login(ADMIN_MOBILE, ADMIN_PASSWORD)
    return {"token": tok, "id": m["id"], "member": m}


@pytest.fixture(scope="module")
def nisha():
    tok, m = _login(NISHA_MOBILE, NISHA_PASSWORD)
    return {"token": tok, "id": m["id"], "member": m}


@pytest.fixture(scope="module")
def meena():
    tok, m = _login(MEENA_MOBILE, MEENA_PASSWORD)
    return {"token": tok, "id": m["id"], "member": m}


def _get_notifs(token, member_id=None):
    # /notifications returns all for user (admin sees all if no filter? check impl)
    url = f"{API}/notifications"
    if member_id:
        url += f"?memberId={member_id}"
    r = requests.get(url, headers=_hdr(token), timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def _find_notif(notifs, ntype, ref_id=None, member_id=None):
    for n in notifs:
        if n.get("type") == ntype:
            if ref_id and n.get("referenceId") != ref_id:
                continue
            if member_id and n.get("memberId") != member_id:
                continue
            return n
    return None


# -------- manual penalty (POST /api/penalties) --------
class TestManualPenalty:
    def test_admin_creates_manual_penalty_and_fires_notification(self, admin, nisha):
        body = {
            "memberId": nisha["id"],
            "type": "manual",
            "amount": 250,
            "daysLate": 0,
            "date": _today(),
            "description": "late meeting",
        }
        r = requests.post(f"{API}/penalties", headers=_hdr(admin["token"]), json=body, timeout=10)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["amount"] == 250
        assert p["type"] == "manual"
        assert p["memberId"] == nisha["id"]
        assert "id" in p
        # check notification
        notifs = _get_notifs(nisha["token"], nisha["id"])
        n = _find_notif(notifs, "penalty_added", ref_id=p["id"], member_id=nisha["id"])
        assert n is not None, "penalty_added notif missing"
        assert "250" in n["message"]
        assert "late meeting" in n["message"]
        # cleanup
        requests.delete(f"{API}/penalties/{p['id']}", headers=_hdr(admin["token"]), timeout=10)

    def test_penalty_type_emi_accepted(self, admin, meena):
        body = {"memberId": meena["id"], "type": "emi", "amount": 50, "daysLate": 2, "date": _today()}
        r = requests.post(f"{API}/penalties", headers=_hdr(admin["token"]), json=body, timeout=10)
        assert r.status_code == 200
        assert r.json()["type"] == "emi"
        requests.delete(f"{API}/penalties/{r.json()['id']}", headers=_hdr(admin["token"]), timeout=10)

    def test_penalty_type_contribution_accepted(self, admin, meena):
        body = {"memberId": meena["id"], "type": "contribution", "amount": 30, "daysLate": 1, "date": _today()}
        r = requests.post(f"{API}/penalties", headers=_hdr(admin["token"]), json=body, timeout=10)
        assert r.status_code == 200
        assert r.json()["type"] == "contribution"
        requests.delete(f"{API}/penalties/{r.json()['id']}", headers=_hdr(admin["token"]), timeout=10)

    def test_non_admin_forbidden_post(self, nisha):
        body = {"memberId": nisha["id"], "type": "manual", "amount": 100, "daysLate": 0, "date": _today()}
        r = requests.post(f"{API}/penalties", headers=_hdr(nisha["token"]), json=body, timeout=10)
        assert r.status_code == 403

    def test_invalid_member_404(self, admin):
        body = {"memberId": "bogus-id-nope", "type": "manual", "amount": 100, "daysLate": 0, "date": _today()}
        r = requests.post(f"{API}/penalties", headers=_hdr(admin["token"]), json=body, timeout=10)
        assert r.status_code == 404

    def test_delete_penalty_fires_removed_notif(self, admin, nisha):
        # create
        body = {"memberId": nisha["id"], "type": "manual", "amount": 75, "daysLate": 0, "date": _today(), "description": "tmp"}
        r = requests.post(f"{API}/penalties", headers=_hdr(admin["token"]), json=body, timeout=10)
        pid = r.json()["id"]
        # delete
        r = requests.delete(f"{API}/penalties/{pid}", headers=_hdr(admin["token"]), timeout=10)
        assert r.status_code == 200
        # check removed notif
        notifs = _get_notifs(nisha["token"], nisha["id"])
        n = _find_notif(notifs, "penalty_removed", ref_id=pid, member_id=nisha["id"])
        assert n is not None, "penalty_removed notif missing"
        assert "75" in n["message"]

    def test_delete_penalty_404(self, admin):
        r = requests.delete(f"{API}/penalties/{uuid.uuid4()}", headers=_hdr(admin["token"]), timeout=10)
        assert r.status_code == 404

    def test_delete_penalty_non_admin_forbidden(self, nisha):
        r = requests.delete(f"{API}/penalties/{uuid.uuid4()}", headers=_hdr(nisha["token"]), timeout=10)
        assert r.status_code == 403


# -------- contribution notify --------
class TestContributionNotif:
    def test_admin_add_contribution_fires_notification(self, admin, meena):
        # unique month per run
        month = f"2099-{(int(time.time()) % 12) + 1:02d}"
        body = {"memberId": meena["id"], "month": month, "paidDate": _today(), "applyPenalty": False}
        r = requests.post(f"{API}/contributions", headers=_hdr(admin["token"]), json=body, timeout=10)
        if r.status_code == 400 and "exists" in r.text.lower():
            # bump month
            month = f"2099-{((int(time.time()) + 5) % 12) + 1:02d}"
            body["month"] = month
            r = requests.post(f"{API}/contributions", headers=_hdr(admin["token"]), json=body, timeout=10)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        notifs = _get_notifs(meena["token"], meena["id"])
        n = _find_notif(notifs, "contribution_added", ref_id=cid, member_id=meena["id"])
        assert n is not None
        assert month in n["message"]
        # cleanup
        requests.delete(f"{API}/contributions/{cid}", headers=_hdr(admin["token"]), timeout=10)


# -------- savings notifications --------
class TestSavingsNotif:
    def test_admin_deposit_fires_savings_credit(self, admin, nisha):
        body = {"memberId": nisha["id"], "amount": 500, "date": _today(), "description": "test admin deposit"}
        r = requests.post(f"{API}/savings/deposit", headers=_hdr(admin["token"]), json=body, timeout=10)
        assert r.status_code == 200, r.text
        txn = r.json()
        assert txn["status"] == "approved"
        notifs = _get_notifs(nisha["token"], nisha["id"])
        n = _find_notif(notifs, "savings_credit", ref_id=txn["id"], member_id=nisha["id"])
        assert n is not None
        assert "500" in n["message"]

    def test_self_deposit_no_immediate_notification(self, nisha):
        body = {"memberId": nisha["id"], "amount": 123, "date": _today(), "description": "self test"}
        r = requests.post(f"{API}/savings/deposit", headers=_hdr(nisha["token"]), json=body, timeout=10)
        assert r.status_code == 200, r.text
        txn = r.json()
        assert txn["status"] == "pending"
        notifs = _get_notifs(nisha["token"], nisha["id"])
        # no savings_credit for this referenceId
        assert _find_notif(notifs, "savings_credit", ref_id=txn["id"]) is None
        # also no savings_approved yet
        assert _find_notif(notifs, "savings_approved", ref_id=txn["id"]) is None

    def test_withdraw_fires_savings_debit(self, admin, nisha):
        # ensure enough balance via admin deposit
        requests.post(
            f"{API}/savings/deposit",
            headers=_hdr(admin["token"]),
            json={"memberId": nisha["id"], "amount": 1000, "date": _today(), "description": "topup"},
            timeout=10,
        )
        body = {"memberId": nisha["id"], "amount": 100, "date": _today(), "description": "test withdraw"}
        r = requests.post(f"{API}/savings/withdraw", headers=_hdr(admin["token"]), json=body, timeout=10)
        assert r.status_code == 200, r.text
        txn = r.json()
        notifs = _get_notifs(nisha["token"], nisha["id"])
        n = _find_notif(notifs, "savings_debit", ref_id=txn["id"], member_id=nisha["id"])
        assert n is not None
        assert "100" in n["message"]


# -------- loan approve / reject / emi notifications --------
class TestLoanNotif:
    def _create_loan(self, admin, member, amount=2000, months=2):
        # Apply as member, approve via admin
        # Find guarantors first (members not the borrower)
        r = requests.get(f"{API}/loans/eligible-guarantors/{member['id']}", headers=_hdr(admin["token"]), timeout=10)
        guarantors = r.json() if r.status_code == 200 else []
        # use first two
        g_ids = [g["id"] for g in guarantors[:2]]
        body = {
            "memberId": member["id"],
            "amount": amount,
            "months": months,
            "interestRate": 2,
            "purpose": "test loan",
            "guarantorIds": g_ids,
        }
        r = requests.post(f"{API}/loans/apply", headers=_hdr(member["token"]), json=body, timeout=15)
        return r

    def test_approve_loan_fires_notification(self, admin, meena):
        r = self._create_loan(admin, meena, amount=1500, months=2)
        if r.status_code != 200:
            pytest.skip(f"Cannot apply loan: {r.status_code} {r.text}")
        loan_id = r.json()["id"]
        r = requests.post(f"{API}/loans/{loan_id}/approve", headers=_hdr(admin["token"]), timeout=10)
        assert r.status_code == 200
        notifs = _get_notifs(meena["token"], meena["id"])
        n = _find_notif(notifs, "loan_approved", ref_id=loan_id, member_id=meena["id"])
        assert n is not None, "loan_approved notification missing"

    def test_reject_loan_fires_notification(self, admin, nisha):
        r = self._create_loan(admin, nisha, amount=1000, months=2)
        if r.status_code != 200:
            pytest.skip(f"Cannot apply loan: {r.status_code} {r.text}")
        loan_id = r.json()["id"]
        r = requests.post(f"{API}/loans/{loan_id}/reject", headers=_hdr(admin["token"]), timeout=10)
        assert r.status_code == 200
        notifs = _get_notifs(nisha["token"], nisha["id"])
        n = _find_notif(notifs, "loan_rejected", ref_id=loan_id, member_id=nisha["id"])
        assert n is not None, "loan_rejected notification missing"

    def test_emi_pay_fires_notification(self, admin, meena):
        # find an active loan for meena (created in approve test)
        r = requests.get(f"{API}/loans", headers=_hdr(admin["token"]), timeout=10)
        assert r.status_code == 200
        loans = [l for l in r.json() if l["memberId"] == meena["id"] and l["status"] == "active"]
        if not loans:
            pytest.skip("No active loan for meena")
        loan = loans[0]
        unpaid = [e for e in loan["emiHistory"] if e["status"] == "pending"]
        if not unpaid:
            pytest.skip("No unpaid EMI")
        emi_num = unpaid[0]["emiNumber"]
        body = {"loanId": loan["id"], "emiNumber": emi_num, "paidDate": _today(), "applyPenalty": False, "flexibleAmount": 0}
        r = requests.post(f"{API}/loans/emi-pay", headers=_hdr(admin["token"]), json=body, timeout=10)
        assert r.status_code == 200, r.text
        notifs = _get_notifs(meena["token"], meena["id"])
        n = _find_notif(notifs, "emi_paid", ref_id=loan["id"], member_id=meena["id"])
        assert n is not None
        assert f"#{emi_num}" in n["message"]


# -------- interest distribute notification --------
class TestInterestNotif:
    def test_distribute_interest_fires_notifs(self, admin, nisha, meena):
        r = requests.post(f"{API}/savings/distribute-interest", headers=_hdr(admin["token"]), timeout=15)
        if r.status_code != 200:
            pytest.skip(f"distribute interest not applicable: {r.status_code} {r.text}")
        j = r.json()
        transferred = j.get("transferred", [])
        if not transferred:
            pytest.skip("No members received interest")
        # Verify at least one member that received interest got the notification (use their own token)
        token_map = {nisha["id"]: nisha["token"], meena["id"]: meena["token"]}
        verified = 0
        for entry in transferred:
            tok = token_map.get(entry["memberId"])
            if not tok:
                continue
            notifs = _get_notifs(tok)
            n = _find_notif(notifs, "interest_credit", member_id=entry["memberId"])
            assert n is not None, f"interest_credit missing for {entry['memberId']}"
            verified += 1
        if verified == 0:
            pytest.skip("Neither nisha nor meena in transferred list")


# -------- clear-transactions (LAST – destructive) --------
class TestClearTransactions:
    def test_non_admin_forbidden(self, nisha):
        r = requests.post(f"{API}/admin/clear-transactions", headers=_hdr(nisha["token"]), timeout=10)
        assert r.status_code == 403

    def test_admin_clears_and_returns_counts(self, admin):
        # Seed: penalty + contribution + admin savings deposit so counts > 0
        m = requests.get(f"{API}/members", headers=_hdr(admin["token"]), timeout=10).json()
        non_admin = next((x for x in m if not x.get("isAdmin")), None)
        assert non_admin is not None
        # create penalty
        requests.post(
            f"{API}/penalties",
            headers=_hdr(admin["token"]),
            json={"memberId": non_admin["id"], "type": "manual", "amount": 10, "daysLate": 0, "date": _today()},
            timeout=10,
        )
        # admin deposit
        requests.post(
            f"{API}/savings/deposit",
            headers=_hdr(admin["token"]),
            json={"memberId": non_admin["id"], "amount": 5, "date": _today(), "description": "seed"},
            timeout=10,
        )
        # member count before
        members_before = len(m)
        settings_before = requests.get(f"{API}/settings", headers=_hdr(admin["token"]), timeout=10).json()
        r = requests.post(f"{API}/admin/clear-transactions", headers=_hdr(admin["token"]), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        d = body["deleted"]
        for key in ("loans", "contributions", "savings", "penalties", "notifications"):
            assert key in d, f"missing key {key}"
            assert isinstance(d[key], int)
        # at least 1 penalty + 1 savings created above
        assert d["penalties"] >= 1
        assert d["savings"] >= 1
        # verify all collections empty after
        for endpoint in ("loans", "contributions", "savings", "penalties"):
            r = requests.get(f"{API}/{endpoint}", headers=_hdr(admin["token"]), timeout=10)
            assert r.status_code == 200
            assert r.json() == [] or len(r.json()) == 0
        # notifications empty for admin
        r = requests.get(f"{API}/notifications", headers=_hdr(admin["token"]), timeout=10)
        assert r.json() == [] or len(r.json()) == 0
        # members intact
        m2 = requests.get(f"{API}/members", headers=_hdr(admin["token"]), timeout=10).json()
        assert len(m2) == members_before
        # settings intact
        settings_after = requests.get(f"{API}/settings", headers=_hdr(admin["token"]), timeout=10).json()
        assert settings_after["upiId"] == settings_before["upiId"]
        assert settings_after["monthlyContribution"] == settings_before["monthlyContribution"]
