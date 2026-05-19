"""
Iter4 backend tests for SHG BANK:
- GET /api/members/{id}/full-detail (admin / self / forbidden / 404 / no _id / guarantorLoans)
- POST /api/loans/emi-pay with flexibleAmount (override / fallback / partial)
- PUT /api/loans/{loan_id}/emi/{emi_id} (edit fields / recompute remaining / 404 / completed)
- PUT /api/members/{id} now accepts joiningDate
- Authorization checks for non-admin
"""
import os
import pytest
import requests

def _read_backend_url():
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if not val:
        # Fall back to frontend/.env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        val = line.split("=", 1)[1].strip()
                        break
        except FileNotFoundError:
            pass
    assert val, "REACT_APP_BACKEND_URL not set"
    return val.rstrip("/") + "/api"


BASE_URL = _read_backend_url()

ADMIN = ("9315341037", "1311")
NISHA = ("9711321568", "1568")
MEENA = ("9289137685", "7685")


# ---------- helpers ----------
def login(mobile, password):
    r = requests.post(f"{BASE_URL}/auth/login", json={"mobile": mobile, "password": password})
    assert r.status_code == 200, f"login failed for {mobile}: {r.text}"
    j = r.json()
    return j["token"], j["member"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_ctx():
    tok, m = login(*ADMIN)
    return {"token": tok, "id": m["id"]}


@pytest.fixture(scope="module")
def nisha_ctx():
    tok, m = login(*NISHA)
    return {"token": tok, "id": m["id"]}


@pytest.fixture(scope="module")
def meena_ctx():
    tok, m = login(*MEENA)
    return {"token": tok, "id": m["id"]}


# ============================================================
# 1. Full-Detail endpoint
# ============================================================
class TestFullDetail:
    def test_admin_get_full_detail(self, admin_ctx, nisha_ctx):
        r = requests.get(f"{BASE_URL}/members/{nisha_ctx['id']}/full-detail", headers=hdr(admin_ctx["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["member", "loans", "contributions", "savings", "penalties", "guarantorLoans"]:
            assert k in data, f"missing key {k}"
        assert data["member"]["id"] == nisha_ctx["id"]
        # No mongo _id leaks anywhere
        assert "_id" not in data["member"]
        for arr_key in ["loans", "contributions", "savings", "penalties", "guarantorLoans"]:
            for item in data[arr_key]:
                assert "_id" not in item, f"{arr_key} item leaks _id"

    def test_member_can_get_own_full_detail(self, nisha_ctx):
        r = requests.get(f"{BASE_URL}/members/{nisha_ctx['id']}/full-detail", headers=hdr(nisha_ctx["token"]))
        assert r.status_code == 200, r.text
        assert r.json()["member"]["id"] == nisha_ctx["id"]

    def test_member_cannot_get_others_full_detail(self, nisha_ctx, meena_ctx):
        r = requests.get(f"{BASE_URL}/members/{meena_ctx['id']}/full-detail", headers=hdr(nisha_ctx["token"]))
        assert r.status_code == 403, r.text

    def test_full_detail_404(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/members/nonexistent-id-xyz/full-detail", headers=hdr(admin_ctx["token"]))
        assert r.status_code == 404, r.text

    def test_guarantor_loans_populated(self, admin_ctx, nisha_ctx, meena_ctx):
        """If MEENA is guarantor on a loan, MEENA's guarantorLoans must contain it."""
        # Find an existing loan with a guarantor, OR create one
        loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        guar_loan = next((l for l in loans if l.get("guarantorId")), None)
        if not guar_loan:
            pytest.skip("No loan with guarantor in DB; would need to create one above threshold")
        gid = guar_loan["guarantorId"]
        r = requests.get(f"{BASE_URL}/members/{gid}/full-detail", headers=hdr(admin_ctx["token"]))
        assert r.status_code == 200
        data = r.json()
        ids = [l["id"] for l in data["guarantorLoans"]]
        assert guar_loan["id"] in ids, "guarantorLoans missing the guaranteed loan"


# ============================================================
# 2. Custom (flexible) EMI payment
# ============================================================
def _create_active_loan(admin_tok, member_id, amount=10000, months=4):
    """Apply + approve a loan and return the loan dict."""
    r = requests.post(f"{BASE_URL}/loans/apply",
                      json={"memberId": member_id, "amount": amount, "months": months},
                      headers=hdr(admin_tok))
    assert r.status_code == 200, f"loan apply failed: {r.text}"
    loan = r.json()
    appr = requests.post(f"{BASE_URL}/loans/{loan['id']}/approve", headers=hdr(admin_tok))
    assert appr.status_code == 200, appr.text
    # Refetch to get active status
    loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_tok)).json()
    return next(l for l in loans if l["id"] == loan["id"])


def _get_unpaid_eligible_member(admin_tok):
    """Find an active member without active loans we can give a fresh loan to."""
    members = requests.get(f"{BASE_URL}/members", headers=hdr(admin_tok)).json()
    loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_tok)).json()
    busy_ids = {l["memberId"] for l in loans if l["status"] in ("active", "pending")}
    busy_ids |= {l["guarantorId"] for l in loans if l.get("guarantorId") and l["status"] == "active"}
    for m in members:
        if not m.get("isAdmin") and m.get("isActive", True) and m["id"] not in busy_ids:
            return m
    pytest.skip("No eligible member without an active loan")


class TestFlexibleEMI:
    @pytest.fixture(scope="class")
    def fresh_loan(self, admin_ctx):
        """Create a fresh active loan we can pay EMIs on."""
        member = _get_unpaid_eligible_member(admin_ctx["token"])
        loan = _create_active_loan(admin_ctx["token"], member["id"], amount=10000, months=4)
        return loan

    def test_flexible_amount_overrides_emi(self, admin_ctx, fresh_loan):
        loan = fresh_loan
        emi1 = next(e for e in loan["emiHistory"] if e["emiNumber"] == 1)
        original_emi_amount = emi1["amount"]
        flex = original_emi_amount + 500  # pay extra
        before_remaining = loan["remainingAmount"]
        r = requests.post(f"{BASE_URL}/loans/emi-pay", headers=hdr(admin_ctx["token"]),
                          json={"loanId": loan["id"], "emiNumber": 1, "paidDate": "2026-01-15",
                                "applyPenalty": False, "flexibleAmount": flex})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("actualAmount") == flex, f"actualAmount mismatch: {j}"
        # Verify persisted
        loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        ln = next(l for l in loans if l["id"] == loan["id"])
        emi_after = next(e for e in ln["emiHistory"] if e["emiNumber"] == 1)
        assert emi_after["status"] == "paid"
        assert emi_after["amount"] == flex, "stored EMI amount must equal flex"
        assert ln["remainingAmount"] == max(0, before_remaining - flex), \
            f"remaining {ln['remainingAmount']} != {before_remaining}-{flex}"

    def test_no_flexible_uses_original(self, admin_ctx, fresh_loan):
        loan = fresh_loan
        # Refetch current state
        loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        ln = next(l for l in loans if l["id"] == loan["id"])
        emi2 = next(e for e in ln["emiHistory"] if e["emiNumber"] == 2)
        orig = emi2["amount"]
        before = ln["remainingAmount"]
        r = requests.post(f"{BASE_URL}/loans/emi-pay", headers=hdr(admin_ctx["token"]),
                          json={"loanId": loan["id"], "emiNumber": 2, "paidDate": "2026-01-15",
                                "applyPenalty": False})
        assert r.status_code == 200, r.text
        assert r.json()["actualAmount"] == orig
        loans2 = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        ln2 = next(l for l in loans2 if l["id"] == loan["id"])
        assert ln2["remainingAmount"] == max(0, before - orig)

    def test_flexible_zero_falls_back(self, admin_ctx, fresh_loan):
        loan = fresh_loan
        loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        ln = next(l for l in loans if l["id"] == loan["id"])
        emi3 = next(e for e in ln["emiHistory"] if e["emiNumber"] == 3)
        orig = emi3["amount"]
        r = requests.post(f"{BASE_URL}/loans/emi-pay", headers=hdr(admin_ctx["token"]),
                          json={"loanId": loan["id"], "emiNumber": 3, "paidDate": "2026-01-15",
                                "applyPenalty": False, "flexibleAmount": 0})
        assert r.status_code == 200, r.text
        assert r.json()["actualAmount"] == orig, "flexibleAmount=0 must fall back to original"

    def test_partial_amount_reduces_remaining(self, admin_ctx, fresh_loan):
        loan = fresh_loan
        loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        ln = next(l for l in loans if l["id"] == loan["id"])
        emi4 = next(e for e in ln["emiHistory"] if e["emiNumber"] == 4)
        if emi4["status"] == "paid":
            pytest.skip("EMI 4 already paid")
        partial = max(100, emi4["amount"] // 2)
        before = ln["remainingAmount"]
        r = requests.post(f"{BASE_URL}/loans/emi-pay", headers=hdr(admin_ctx["token"]),
                          json={"loanId": loan["id"], "emiNumber": 4, "paidDate": "2026-01-15",
                                "applyPenalty": False, "flexibleAmount": partial})
        assert r.status_code == 200, r.text
        assert r.json()["actualAmount"] == partial
        loans2 = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        ln2 = next(l for l in loans2 if l["id"] == loan["id"])
        assert ln2["remainingAmount"] == max(0, before - partial)

    def test_nonadmin_cannot_pay_emi(self, nisha_ctx, fresh_loan):
        r = requests.post(f"{BASE_URL}/loans/emi-pay", headers=hdr(nisha_ctx["token"]),
                          json={"loanId": fresh_loan["id"], "emiNumber": 1, "paidDate": "2026-01-15",
                                "flexibleAmount": 1000})
        assert r.status_code == 403


# ============================================================
# 3. Edit EMI (PUT /loans/{loan_id}/emi/{emi_id})
# ============================================================
class TestEditEMI:
    @pytest.fixture(scope="class")
    def edit_loan(self, admin_ctx):
        member = _get_unpaid_eligible_member(admin_ctx["token"])
        return _create_active_loan(admin_ctx["token"], member["id"], amount=8000, months=3)

    def test_edit_emi_fields(self, admin_ctx, edit_loan):
        loan = edit_loan
        emi1 = loan["emiHistory"][0]
        r = requests.put(f"{BASE_URL}/loans/{loan['id']}/emi/{emi1['id']}", headers=hdr(admin_ctx["token"]),
                         json={"amount": 2500, "paidDate": "2026-01-10", "penalty": 50, "status": "paid"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["success"] is True
        assert j["emi"]["amount"] == 2500
        assert j["emi"]["status"] == "paid"
        assert j["emi"]["penalty"] == 50

    def test_edit_recomputes_remaining(self, admin_ctx, edit_loan):
        loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        ln = next(l for l in loans if l["id"] == edit_loan["id"])
        paid_sum = sum(e["amount"] for e in ln["emiHistory"] if e["status"] == "paid")
        expected = max(0, ln["totalPayable"] - paid_sum)
        assert ln["remainingAmount"] == expected, \
            f"remaining {ln['remainingAmount']} != totalPayable - paid_sum {expected}"

    def test_edit_emi_404_unknown_emi_id(self, admin_ctx, edit_loan):
        r = requests.put(f"{BASE_URL}/loans/{edit_loan['id']}/emi/bogus-emi-id-xxx",
                         headers=hdr(admin_ctx["token"]),
                         json={"amount": 100})
        assert r.status_code == 404, r.text

    def test_edit_emi_admin_only(self, nisha_ctx, edit_loan):
        emi1_id = edit_loan["emiHistory"][0]["id"]
        r = requests.put(f"{BASE_URL}/loans/{edit_loan['id']}/emi/{emi1_id}",
                         headers=hdr(nisha_ctx["token"]),
                         json={"amount": 999})
        assert r.status_code == 403, r.text

    def test_all_paid_marks_loan_completed(self, admin_ctx):
        """Create a tiny 2-month loan, mark all EMIs paid via edit, expect status=completed."""
        member = _get_unpaid_eligible_member(admin_ctx["token"])
        loan = _create_active_loan(admin_ctx["token"], member["id"], amount=4000, months=2)
        for emi in loan["emiHistory"]:
            r = requests.put(f"{BASE_URL}/loans/{loan['id']}/emi/{emi['id']}",
                             headers=hdr(admin_ctx["token"]),
                             json={"status": "paid", "paidDate": "2026-01-15"})
            assert r.status_code == 200, r.text
        loans = requests.get(f"{BASE_URL}/loans", headers=hdr(admin_ctx["token"])).json()
        ln = next(l for l in loans if l["id"] == loan["id"])
        assert ln["status"] == "completed", f"loan status should be 'completed', got {ln['status']}"


# ============================================================
# 4. PUT /members/{id} accepts joiningDate
# ============================================================
class TestUpdateMemberJoiningDate:
    def test_admin_can_update_joining_date(self, admin_ctx, meena_ctx):
        new_date = "2025-08-01"
        r = requests.put(f"{BASE_URL}/members/{meena_ctx['id']}",
                         headers=hdr(admin_ctx["token"]),
                         json={"joiningDate": new_date})
        assert r.status_code == 200, r.text
        # Verify via GET
        members = requests.get(f"{BASE_URL}/members", headers=hdr(admin_ctx["token"])).json()
        m = next(x for x in members if x["id"] == meena_ctx["id"])
        assert m["joiningDate"].startswith(new_date), f"expected {new_date}, got {m['joiningDate']}"
        # Restore
        requests.put(f"{BASE_URL}/members/{meena_ctx['id']}",
                     headers=hdr(admin_ctx["token"]),
                     json={"joiningDate": "2025-09-10"})
