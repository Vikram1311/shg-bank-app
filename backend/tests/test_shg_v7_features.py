"""
SHG BANK - Iteration 7 backend tests

Focus:
  1. Loan Calculator endpoint correctness (regression for slider/race fix on FE).
  2. New /api/members/{id}/stats fields: grossContribution, ownPenaltyPaid,
     and totalContribution = gross - ownPenaltyPaid (PRD #10 auto-deduct).
  3. Regression sanity on auth, contributions add, delete, settings.
"""
import os
import pytest
import requests
from pathlib import Path

# ---- BASE_URL resolution (env first, fallback to frontend/.env) ----
def _load_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    env = Path("/app/frontend/.env")
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_url()
API = f"{BASE_URL}/api"

ADMIN = {"mobile": "9315341037", "password": "1311"}
NISHA = {"mobile": "9711321568", "password": "1568"}
MEENA = {"mobile": "9289137685", "password": "7685"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def member_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=NISHA, timeout=15)
    assert r.status_code == 200, f"member login failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    s.member = r.json()["member"]
    return s


@pytest.fixture(scope="module")
def nisha_id(admin_session):
    r = admin_session.get(f"{API}/members", timeout=15)
    assert r.status_code == 200
    for m in r.json():
        if m["mobile"] == NISHA["mobile"]:
            return m["id"]
    pytest.skip("NISHA not in member list")


@pytest.fixture(scope="module")
def meena_id(admin_session):
    r = admin_session.get(f"{API}/members", timeout=15)
    for m in r.json():
        if m["mobile"] == MEENA["mobile"]:
            return m["id"]
    pytest.skip("MEENA not in member list")


# -------------------- Auth regression --------------------
class TestAuthBasic:
    def test_admin_login_returns_token_and_member(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 0
        assert body["member"]["isAdmin"] is True
        assert body["member"]["mobile"] == ADMIN["mobile"]

    def test_member_login_returns_token(self):
        r = requests.post(f"{API}/auth/login", json=NISHA, timeout=15)
        assert r.status_code == 200
        assert r.json()["member"]["mobile"] == NISHA["mobile"]
        assert r.json()["member"]["isAdmin"] is False

    def test_invalid_login(self):
        r = requests.post(f"{API}/auth/login",
                          json={"mobile": NISHA["mobile"], "password": "wrong"}, timeout=15)
        assert r.status_code in (400, 401, 403)


# -------------------- Loan Calculator (regression) --------------------
class TestLoanCalculator:
    """Confirm /api/loans/calculator is deterministic — FE race fix relies on this
    backend always returning the SAME EMI for a given (amount, months)."""

    def test_calc_30000_3_months(self, member_session, nisha_id):
        r = member_session.post(
            f"{API}/loans/calculator",
            json={"memberId": nisha_id, "amount": 30000, "months": 3},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # EMI ~ 10403 (declining-balance at 2% per month gives ~10403)
        assert "emi" in data or "emiAmount" in data or "monthlyEmi" in data, f"unexpected: {data}"
        emi_keys = [k for k in data if "emi" in k.lower() and isinstance(data[k], (int, float))]
        assert emi_keys, f"No emi field: {data}"
        emi = data[emi_keys[0]]
        # Per review-request: EMI should be approximately 10403
        assert 10300 <= emi <= 10500, f"EMI {emi} not ~10403 for 30000/3"

    def test_calc_5000_3_months(self, member_session, nisha_id):
        r = member_session.post(
            f"{API}/loans/calculator",
            json={"memberId": nisha_id, "amount": 5000, "months": 3},
            timeout=15,
        )
        assert r.status_code == 200
        # EMI for 5000/3 should be lower than 30000/3
        emi_keys = [k for k in r.json() if "emi" in k.lower() and isinstance(r.json()[k], (int, float))]
        emi = r.json()[emi_keys[0]]
        assert 1500 <= emi <= 2000, f"5000/3 EMI {emi} out of expected range"

    def test_calc_15000_3_months(self, member_session, nisha_id):
        r = member_session.post(
            f"{API}/loans/calculator",
            json={"memberId": nisha_id, "amount": 15000, "months": 3},
            timeout=15,
        )
        assert r.status_code == 200
        emi_keys = [k for k in r.json() if "emi" in k.lower() and isinstance(r.json()[k], (int, float))]
        emi = r.json()[emi_keys[0]]
        assert 5000 <= emi <= 5500, f"15000/3 EMI {emi} out of expected range"

    def test_calc_600_6_months(self, member_session, nisha_id):
        r = member_session.post(
            f"{API}/loans/calculator",
            json={"memberId": nisha_id, "amount": 600, "months": 6},
            timeout=15,
        )
        assert r.status_code == 200
        emi_keys = [k for k in r.json() if "emi" in k.lower() and isinstance(r.json()[k], (int, float))]
        emi = r.json()[emi_keys[0]]
        # Reasonable EMI: 600 / 6 ~= 100, plus small interest
        assert 80 <= emi <= 150, f"600/6 EMI {emi} out of expected range"

    def test_calc_repeatable(self, member_session, nisha_id):
        """Same inputs must produce same output (no random/race on backend)."""
        results = []
        for _ in range(5):
            r = member_session.post(
                f"{API}/loans/calculator",
                json={"memberId": nisha_id, "amount": 30000, "months": 3},
                timeout=15,
            )
            assert r.status_code == 200
            emi_keys = [k for k in r.json() if "emi" in k.lower() and isinstance(r.json()[k], (int, float))]
            results.append(r.json()[emi_keys[0]])
        assert len(set(results)) == 1, f"calculator returned different EMIs: {results}"


# -------------------- Member Stats new fields (PRD #10) --------------------
class TestMemberStatsNewFields:
    """grossContribution, ownPenaltyPaid, totalContribution == gross - ownPenaltyPaid"""

    def test_stats_exposes_new_fields(self, admin_session, nisha_id):
        r = admin_session.get(f"{API}/members/{nisha_id}/stats", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("totalContribution", "grossContribution", "ownPenaltyPaid"):
            assert k in data, f"missing field {k} in stats: {list(data.keys())}"
            assert isinstance(data[k], (int, float)), f"{k} should be number"

    def test_total_equals_gross_minus_own_penalty(self, admin_session, nisha_id):
        r = admin_session.get(f"{API}/members/{nisha_id}/stats", timeout=15)
        d = r.json()
        expected = max(0, round(d["grossContribution"] - d["ownPenaltyPaid"], 2))
        assert abs(d["totalContribution"] - expected) < 0.02, \
            f"totalContribution {d['totalContribution']} != gross {d['grossContribution']} - ownPenaltyPaid {d['ownPenaltyPaid']}"

    def test_stats_for_all_members_invariant(self, admin_session):
        """Across every member, totalContribution == max(0, gross - ownPenaltyPaid)."""
        r = admin_session.get(f"{API}/members", timeout=15)
        bad = []
        for m in r.json():
            if not m.get("isActive"):
                continue
            sr = admin_session.get(f"{API}/members/{m['id']}/stats", timeout=15)
            if sr.status_code != 200:
                continue
            d = sr.json()
            expected = max(0, round(d["grossContribution"] - d["ownPenaltyPaid"], 2))
            if abs(d["totalContribution"] - expected) > 0.02:
                bad.append((m["name"], d["totalContribution"], d["grossContribution"], d["ownPenaltyPaid"]))
        assert not bad, f"Invariant broken for: {bad}"

    def test_penalty_applied_reduces_total_contribution(self, admin_session, meena_id):
        """E2E: admin adds a late contribution -> ownPenaltyPaid up, totalContribution = gross - own_penalty."""
        # Snapshot before
        before = admin_session.get(f"{API}/members/{meena_id}/stats", timeout=15).json()
        gross_b = before["grossContribution"]
        own_b = before["ownPenaltyPaid"]
        total_b = before["totalContribution"]

        # Pick a future-safe month that is unlikely paid. Use 2030-01 which is far past
        # joining and definitely not present.
        TEST_MONTH = "2030-01"
        # Cleanup just in case
        # No direct delete-by-month API; we'll use add and then DELETE via contribution id.

        created = admin_session.post(
            f"{API}/contributions",
            json={"memberId": meena_id, "month": TEST_MONTH,
                  "paidDate": "2030-02-15", "applyPenalty": True},
            timeout=15,
        )
        if created.status_code == 400:
            pytest.skip(f"Month {TEST_MONTH} already exists for MEENA; cannot run this scenario")
        assert created.status_code == 200, created.text
        contrib = created.json()
        contrib_id = contrib["id"]
        penalty_amt = contrib.get("penalty", 0)

        try:
            after = admin_session.get(f"{API}/members/{meena_id}/stats", timeout=15).json()
            # Gross goes up by monthly amount
            assert after["grossContribution"] > gross_b, \
                f"gross did not increase: {gross_b} -> {after['grossContribution']}"
            # ownPenaltyPaid should increase by `penalty_amt` (if penalty was charged)
            if penalty_amt > 0:
                assert round(after["ownPenaltyPaid"] - own_b, 2) == round(penalty_amt, 2), \
                    f"ownPenaltyPaid delta {after['ownPenaltyPaid']-own_b} != penalty {penalty_amt}"
            # totalContribution invariant still holds
            expected = max(0, round(after["grossContribution"] - after["ownPenaltyPaid"], 2))
            assert abs(after["totalContribution"] - expected) < 0.02
            # Net total should be (gross_delta - penalty)
            gross_delta = after["grossContribution"] - gross_b
            own_delta = after["ownPenaltyPaid"] - own_b
            net_delta = after["totalContribution"] - total_b
            assert abs(net_delta - (gross_delta - own_delta)) < 0.02, \
                f"net_delta {net_delta} != gross_delta {gross_delta} - own_delta {own_delta}"
        finally:
            # Cleanup
            admin_session.delete(f"{API}/contributions/{contrib_id}", timeout=15)


# -------------------- Settings (sanity) --------------------
class TestSettings:
    def test_settings_returns_upi(self, member_session):
        r = member_session.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # PaymentWidget uses settings.upiId; backend stores it as some key
        upi_key = next((k for k in data if "upi" in k.lower()), None)
        assert upi_key, f"No upi field in settings: {list(data.keys())}"
        assert "@" in str(data[upi_key])
