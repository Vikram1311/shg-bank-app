from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Dict, Any
import uuid
from datetime import datetime, timezone, date
import math


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ==================== Models ====================

class Member(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    mobile: str
    password: str
    joiningDate: str  # YYYY-MM-DD
    isAdmin: bool = False
    isActive: bool = True
    language: str = "hi"  # hi | en | ta
    profilePhoto: Optional[str] = None
    autoDeductPenalty: bool = True


class EMIRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    emiNumber: int
    amount: float
    interestComponent: float
    principalComponent: float
    dueDate: str
    paidDate: Optional[str] = None
    penalty: float = 0
    status: Literal["pending", "paid"] = "pending"


class Loan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    memberId: str
    memberName: str
    amount: float
    interestRate: float = 2  # 2% monthly declining
    months: int
    totalInterest: float
    totalPayable: float
    emiAmount: float
    remainingAmount: float
    openingDate: str
    closingDate: Optional[str] = None
    nextEmiDate: str
    status: Literal["pending", "active", "completed", "rejected", "recalled"] = "pending"
    isOldLoan: bool = False
    includeInApp: bool = True
    emiHistory: List[EMIRecord] = []


class Contribution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    memberId: str
    memberName: str
    amount: float
    month: str  # YYYY-MM
    dueDate: str
    paidDate: Optional[str] = None
    penalty: float = 0
    status: Literal["pending", "paid"] = "pending"


class PenaltyRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    memberId: str
    type: Literal["contribution", "emi"]
    referenceId: str
    amount: float
    date: str
    daysLate: int


class SavingsTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    memberId: str
    memberName: str
    type: Literal["deposit", "withdrawal"]
    amount: float
    date: str
    description: str = ""


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    upiId: str = "9315341037@INDIE"
    groupName: str = "SHG BANK"
    monthlyContribution: float = 1000
    maxLoanAmount: float = 15000
    interestRate: float = 2
    lateFeePerDay: float = 10
    dueDate: int = 11


class LoginInput(BaseModel):
    mobile: str
    password: str


class ChangePasswordInput(BaseModel):
    memberId: str
    newPassword: str


class UpdateMemberInput(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    password: Optional[str] = None
    language: Optional[str] = None
    profilePhoto: Optional[str] = None
    isActive: Optional[bool] = None
    autoDeductPenalty: Optional[bool] = None


class AddMemberInput(BaseModel):
    name: str
    mobile: str
    joiningDate: str


class LoanApplyInput(BaseModel):
    memberId: str
    amount: float
    months: int


class EMIPayInput(BaseModel):
    loanId: str
    emiNumber: int
    paidDate: str
    applyPenalty: bool = True


class ContributionInput(BaseModel):
    memberId: str
    month: str
    paidDate: str
    applyPenalty: bool = True


class BulkContributionInput(BaseModel):
    month: str
    memberIds: List[str]
    paidDate: str
    applyPenalty: bool = True


class SavingsInput(BaseModel):
    memberId: str
    amount: float
    date: str
    description: str = ""


class OldLoanInput(BaseModel):
    memberId: str
    amount: float
    openingDate: str
    closingDate: Optional[str] = None
    months: int
    interestRate: float = 2
    includeInterest: bool = True
    includeInApp: bool = True


class SettingsUpdate(BaseModel):
    upiId: Optional[str] = None
    groupName: Optional[str] = None
    monthlyContribution: Optional[float] = None
    maxLoanAmount: Optional[float] = None
    interestRate: Optional[float] = None
    lateFeePerDay: Optional[float] = None


# ==================== Calculations ====================

def calculate_emi(principal: float, monthly_rate: float, months: int) -> float:
    if monthly_rate == 0:
        return principal / months
    factor = math.pow(1 + monthly_rate, months)
    return principal * monthly_rate * factor / (factor - 1)


def calculate_loan_details(principal: float, months: int, rate: float = 0.02) -> Dict[str, Any]:
    emi = calculate_emi(principal, rate, months)
    total_payable = emi * months
    total_interest = total_payable - principal
    breakdown = []
    remaining = principal
    for i in range(1, months + 1):
        interest = remaining * rate
        principal_comp = emi - interest
        remaining -= principal_comp
        breakdown.append({
            "emiNumber": i,
            "amount": round(emi, 2),
            "interest": round(interest, 2),
            "principal": round(principal_comp, 2),
            "remaining": round(max(0, remaining), 2),
        })
    return {
        "emi": round(emi, 2),
        "totalPayable": round(total_payable, 2),
        "totalInterest": round(total_interest, 2),
        "breakdown": breakdown,
    }


def calculate_penalty_days(due_date_str: str) -> int:
    """Days late after the 11th of the due month."""
    try:
        due = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
    except Exception:
        due = datetime.strptime(due_date_str[:10], "%Y-%m-%d")
    due_day = datetime(due.year, due.month, 11, 23, 59, 59)
    now = datetime.now()
    if now <= due_day:
        return 0
    return math.ceil((now - due_day).total_seconds() / 86400)


def get_contribution_due_date(month: str) -> str:
    y, m = map(int, month.split("-"))
    return datetime(y, m, 11).isoformat()


def get_default_password(mobile: str) -> str:
    return mobile[-4:]


# ==================== Auth Helper ====================

async def get_current_user(authorization: Optional[str] = Header(None)) -> Member:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.replace("Bearer ", "")
    # token format: memberId
    member = await db.members.find_one({"id": token}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=401, detail="Invalid token")
    return Member(**member)


# ==================== Seed Data ====================

DEFAULT_MEMBERS = [
    {"name": "ADMIN", "mobile": "9315341037", "password": "1311", "joiningDate": "2025-09-10", "isAdmin": True, "language": "hi"},
    {"name": "NISHA", "mobile": "9711321568", "joiningDate": "2025-09-10"},
    {"name": "MEENA", "mobile": "9289137685", "joiningDate": "2025-09-10"},
    {"name": "REKHA", "mobile": "7678253940", "joiningDate": "2025-09-10"},
    {"name": "AMISHA", "mobile": "9211984237", "joiningDate": "2025-09-10"},
    {"name": "MADHU", "mobile": "7838140223", "joiningDate": "2025-09-10"},
    {"name": "RACHNA", "mobile": "8445669184", "joiningDate": "2025-09-10"},
    {"name": "LATESH", "mobile": "7017162405", "joiningDate": "2025-09-10"},
    {"name": "SEEMA", "mobile": "7525820593", "joiningDate": "2025-09-10"},
    {"name": "SEETA", "mobile": "8303972736", "joiningDate": "2025-09-10"},
    {"name": "MUSKAN", "mobile": "9935593567", "joiningDate": "2025-09-10"},
    {"name": "AVNISH", "mobile": "9654784185", "joiningDate": "2025-09-10"},
    {"name": "ASHOK", "mobile": "9354276567", "joiningDate": "2025-09-10"},
    {"name": "RAVI ARUMUGAM", "mobile": "9711891954", "joiningDate": "2025-09-10", "language": "ta"},
    {"name": "RAMNIWAS", "mobile": "9205231995", "joiningDate": "2025-09-10"},
    {"name": "LUCKY", "mobile": "9911303276", "joiningDate": "2025-09-10"},
    {"name": "MAHESH", "mobile": "8700569722", "joiningDate": "2025-09-10"},
    {"name": "MONI", "mobile": "9958422693", "joiningDate": "2025-09-10"},
    {"name": "CHAMAN", "mobile": "9911352254", "joiningDate": "2025-09-10"},
    {"name": "INDERJEET", "mobile": "8285072541", "joiningDate": "2025-09-10"},
    {"name": "N.P. SINGH", "mobile": "9315341038", "joiningDate": "2025-09-10"},
    {"name": "NANDINI", "mobile": "8860693105", "joiningDate": "2026-02-10"},
    {"name": "RUPESH", "mobile": "9696418043", "joiningDate": "2026-01-10"},
    {"name": "GOPAL SHARMA", "mobile": "7678457729", "joiningDate": "2026-05-10"},
]


@app.on_event("startup")
async def seed_data():
    existing = await db.members.count_documents({})
    if existing == 0:
        members_to_insert = []
        for m in DEFAULT_MEMBERS:
            member = Member(
                name=m["name"],
                mobile=m["mobile"],
                password=m.get("password", get_default_password(m["mobile"])),
                joiningDate=m["joiningDate"],
                isAdmin=m.get("isAdmin", False),
                language=m.get("language", "hi"),
            )
            members_to_insert.append(member.model_dump())
        await db.members.insert_many(members_to_insert)
        logging.info(f"Seeded {len(members_to_insert)} members")

    settings = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    if not settings:
        await db.settings.insert_one(Settings().model_dump())
        logging.info("Seeded settings")


# ==================== Auth Routes ====================

@api_router.post("/auth/login")
async def login(input: LoginInput):
    member = await db.members.find_one(
        {"mobile": input.mobile, "password": input.password},
        {"_id": 0},
    )
    if not member:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": member["id"], "member": member}


@api_router.post("/auth/change-password")
async def change_password(input: ChangePasswordInput, user: Member = Depends(get_current_user)):
    # Allow self change or admin reset
    if user.id != input.memberId and not user.isAdmin:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.members.update_one({"id": input.memberId}, {"$set": {"password": input.newPassword}})
    return {"success": True}


@api_router.post("/auth/reset-password/{member_id}")
async def reset_password(member_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    new_pwd = get_default_password(member["mobile"])
    await db.members.update_one({"id": member_id}, {"$set": {"password": new_pwd}})
    return {"success": True, "newPassword": new_pwd}


# ==================== Member Routes ====================

@api_router.get("/members", response_model=List[Member])
async def get_members(user: Member = Depends(get_current_user)):
    members = await db.members.find({}, {"_id": 0}).to_list(100)
    return [Member(**m) for m in members]


@api_router.post("/members", response_model=Member)
async def add_member(input: AddMemberInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    existing = await db.members.find_one({"mobile": input.mobile})
    if existing:
        raise HTTPException(status_code=400, detail="Mobile already exists")
    member = Member(
        name=input.name,
        mobile=input.mobile,
        password=get_default_password(input.mobile),
        joiningDate=input.joiningDate,
    )
    await db.members.insert_one(member.model_dump())
    return member


@api_router.put("/members/{member_id}")
async def update_member(member_id: str, input: UpdateMemberInput, user: Member = Depends(get_current_user)):
    if user.id != member_id and not user.isAdmin:
        raise HTTPException(status_code=403, detail="Forbidden")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.members.update_one({"id": member_id}, {"$set": update_data})
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    return member


@api_router.delete("/members/{member_id}")
async def remove_member(member_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    await db.members.delete_one({"id": member_id})
    await db.loans.delete_many({"memberId": member_id})
    await db.contributions.delete_many({"memberId": member_id})
    await db.penalties.delete_many({"memberId": member_id})
    await db.savings.delete_many({"memberId": member_id})
    return {"success": True}


# ==================== Loan Routes ====================

@api_router.get("/loans", response_model=List[Loan])
async def get_loans(memberId: Optional[str] = None, user: Member = Depends(get_current_user)):
    query = {}
    if memberId:
        query["memberId"] = memberId
    elif not user.isAdmin:
        query["memberId"] = user.id
    loans = await db.loans.find(query, {"_id": 0}).to_list(500)
    return [Loan(**l) for l in loans]


@api_router.post("/loans/calculator")
async def loan_calculator(input: LoanApplyInput):
    settings = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    rate = settings["interestRate"] / 100
    return calculate_loan_details(input.amount, input.months, rate)


@api_router.post("/loans/apply", response_model=Loan)
async def apply_loan(input: LoanApplyInput, user: Member = Depends(get_current_user)):
    settings_doc = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    settings = Settings(**settings_doc)
    if input.amount > settings.maxLoanAmount:
        raise HTTPException(status_code=400, detail=f"Max loan ₹{settings.maxLoanAmount}")
    if input.months < 1 or input.months > 6:
        raise HTTPException(status_code=400, detail="Months must be 1-6")

    # Eligibility: 50% of previous loan must be paid
    active_loans = await db.loans.find({"memberId": input.memberId, "status": {"$in": ["active", "pending"]}}, {"_id": 0}).to_list(50)
    for l in active_loans:
        paid = sum(1 for e in l["emiHistory"] if e["status"] == "paid")
        if paid < math.ceil(l["months"] / 2):
            raise HTTPException(status_code=400, detail="Previous loan: 50% payment pending")

    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    rate = settings.interestRate / 100
    details = calculate_loan_details(input.amount, input.months, rate)
    now = datetime.now()
    closing = datetime(now.year, now.month + input.months if now.month + input.months <= 12 else (now.month + input.months) % 12 or 12,
                       min(now.day, 28)) if False else now  # simplified
    closing_date = (datetime(now.year + (now.month + input.months - 1) // 12, ((now.month + input.months - 1) % 12) + 1, min(now.day, 28))).isoformat()

    emi_history = []
    for i, b in enumerate(details["breakdown"]):
        due_month = now.month + i
        due_year = now.year + (due_month - 1) // 12
        due_month = ((due_month - 1) % 12) + 1
        emi = EMIRecord(
            emiNumber=i + 1,
            amount=b["amount"],
            interestComponent=b["interest"],
            principalComponent=b["principal"],
            dueDate=datetime(due_year, due_month, 11).isoformat(),
        )
        emi_history.append(emi)

    next_emi_month = now.month + 1
    next_year = now.year + (next_emi_month - 1) // 12
    next_emi_month = ((next_emi_month - 1) % 12) + 1
    next_emi_date = datetime(next_year, next_emi_month, 11).isoformat()

    loan = Loan(
        memberId=input.memberId,
        memberName=member["name"],
        amount=input.amount,
        interestRate=settings.interestRate,
        months=input.months,
        totalInterest=details["totalInterest"],
        totalPayable=details["totalPayable"],
        emiAmount=details["emi"],
        remainingAmount=details["totalPayable"],
        openingDate=now.isoformat(),
        closingDate=closing_date,
        nextEmiDate=next_emi_date,
        status="pending",
        emiHistory=emi_history,
    )
    await db.loans.insert_one(loan.model_dump())
    return loan


@api_router.post("/loans/{loan_id}/approve")
async def approve_loan(loan_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    await db.loans.update_one({"id": loan_id}, {"$set": {"status": "active"}})
    return {"success": True}


@api_router.post("/loans/{loan_id}/reject")
async def reject_loan(loan_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    await db.loans.update_one({"id": loan_id}, {"$set": {"status": "rejected"}})
    return {"success": True}


@api_router.post("/loans/{loan_id}/recall")
async def recall_loan(loan_id: str, user: Member = Depends(get_current_user)):
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Not found")
    if loan["memberId"] != user.id and not user.isAdmin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if loan["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending loans can be recalled")
    await db.loans.update_one({"id": loan_id}, {"$set": {"status": "recalled"}})
    return {"success": True}


@api_router.post("/loans/old", response_model=Loan)
async def add_old_loan(input: OldLoanInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    rate = (input.interestRate / 100) if input.includeInterest else 0
    details = calculate_loan_details(input.amount, input.months, rate)
    is_closed = bool(input.closingDate)
    opening = datetime.fromisoformat(input.openingDate) if "T" in input.openingDate else datetime.strptime(input.openingDate, "%Y-%m-%d")
    emi_history = []
    for i, b in enumerate(details["breakdown"]):
        due_month = opening.month + i
        due_year = opening.year + (due_month - 1) // 12
        due_month = ((due_month - 1) % 12) + 1
        emi = EMIRecord(
            emiNumber=i + 1,
            amount=b["amount"],
            interestComponent=b["interest"],
            principalComponent=b["principal"],
            dueDate=datetime(due_year, due_month, 11).isoformat(),
            status="paid" if is_closed else "pending",
        )
        emi_history.append(emi)
    loan = Loan(
        memberId=input.memberId,
        memberName=member["name"],
        amount=input.amount,
        interestRate=input.interestRate if input.includeInterest else 0,
        months=input.months,
        totalInterest=details["totalInterest"] if input.includeInterest else 0,
        totalPayable=details["totalPayable"],
        emiAmount=details["emi"],
        remainingAmount=0 if is_closed else details["totalPayable"],
        openingDate=input.openingDate,
        closingDate=input.closingDate or "",
        nextEmiDate=opening.isoformat(),
        status="completed" if is_closed else "active",
        isOldLoan=True,
        includeInApp=input.includeInApp,
        emiHistory=emi_history,
    )
    await db.loans.insert_one(loan.model_dump())
    return loan


@api_router.post("/loans/emi-pay")
async def pay_emi(input: EMIPayInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    loan = await db.loans.find_one({"id": input.loanId}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    settings_doc = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    fee = settings_doc["lateFeePerDay"]
    emi_history = loan["emiHistory"]
    target_emi = None
    for e in emi_history:
        if e["emiNumber"] == input.emiNumber:
            target_emi = e
            break
    if not target_emi or target_emi["status"] == "paid":
        raise HTTPException(status_code=400, detail="EMI not found or already paid")
    penalty = 0
    days_late = 0
    if input.applyPenalty:
        days_late = calculate_penalty_days(target_emi["dueDate"])
        if days_late > 0:
            penalty = days_late * fee
    target_emi["status"] = "paid"
    target_emi["paidDate"] = input.paidDate
    target_emi["penalty"] = penalty
    new_remaining = max(0, loan["remainingAmount"] - target_emi["amount"])
    all_paid = all(e["status"] == "paid" for e in emi_history)
    new_status = "completed" if all_paid else loan["status"]
    await db.loans.update_one({"id": input.loanId}, {"$set": {
        "emiHistory": emi_history,
        "remainingAmount": new_remaining,
        "status": new_status,
    }})
    if penalty > 0:
        p = PenaltyRecord(memberId=loan["memberId"], type="emi", referenceId=target_emi["id"],
                          amount=penalty, date=input.paidDate, daysLate=days_late)
        await db.penalties.insert_one(p.model_dump())
    return {"success": True, "penalty": penalty}


@api_router.delete("/loans/{loan_id}")
async def delete_loan(loan_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    await db.loans.delete_one({"id": loan_id})
    return {"success": True}


# ==================== Contribution Routes ====================

@api_router.get("/contributions", response_model=List[Contribution])
async def get_contributions(memberId: Optional[str] = None, user: Member = Depends(get_current_user)):
    query = {}
    if memberId:
        query["memberId"] = memberId
    elif not user.isAdmin:
        query["memberId"] = user.id
    contribs = await db.contributions.find(query, {"_id": 0}).to_list(2000)
    return [Contribution(**c) for c in contribs]


@api_router.post("/contributions", response_model=Contribution)
async def add_contribution(input: ContributionInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    existing = await db.contributions.find_one({"memberId": input.memberId, "month": input.month})
    if existing:
        raise HTTPException(status_code=400, detail="Already exists")
    settings_doc = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    due_date = get_contribution_due_date(input.month)
    penalty = 0
    days_late = 0
    if input.applyPenalty:
        days_late = calculate_penalty_days(due_date)
        if days_late > 0:
            penalty = days_late * settings_doc["lateFeePerDay"]
    contribution = Contribution(
        memberId=input.memberId,
        memberName=member["name"],
        amount=settings_doc["monthlyContribution"],
        month=input.month,
        dueDate=due_date,
        paidDate=input.paidDate,
        penalty=penalty,
        status="paid",
    )
    await db.contributions.insert_one(contribution.model_dump())
    if penalty > 0:
        p = PenaltyRecord(memberId=input.memberId, type="contribution", referenceId=contribution.id,
                          amount=penalty, date=input.paidDate, daysLate=days_late)
        await db.penalties.insert_one(p.model_dump())
    return contribution


@api_router.post("/contributions/bulk")
async def add_bulk_contribution(input: BulkContributionInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    added = 0
    for mid in input.memberIds:
        try:
            await add_contribution(ContributionInput(memberId=mid, month=input.month, paidDate=input.paidDate, applyPenalty=input.applyPenalty), user)
            added += 1
        except HTTPException:
            pass
    return {"added": added}


@api_router.delete("/contributions/{contrib_id}")
async def delete_contribution(contrib_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    await db.contributions.delete_one({"id": contrib_id})
    await db.penalties.delete_many({"referenceId": contrib_id})
    return {"success": True}


# ==================== Penalty / Savings ====================

@api_router.get("/penalties", response_model=List[PenaltyRecord])
async def get_penalties(user: Member = Depends(get_current_user)):
    pens = await db.penalties.find({}, {"_id": 0}).to_list(2000)
    return [PenaltyRecord(**p) for p in pens]


@api_router.get("/savings")
async def get_savings(memberId: Optional[str] = None, user: Member = Depends(get_current_user)):
    query = {}
    if memberId:
        query["memberId"] = memberId
    elif not user.isAdmin:
        query["memberId"] = user.id
    txns = await db.savings.find(query, {"_id": 0}).to_list(2000)
    return txns


@api_router.post("/savings/deposit")
async def savings_deposit(input: SavingsInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    txn = SavingsTransaction(memberId=input.memberId, memberName=member["name"], type="deposit",
                             amount=input.amount, date=input.date, description=input.description)
    await db.savings.insert_one(txn.model_dump())
    return txn


@api_router.post("/savings/withdraw")
async def savings_withdraw(input: SavingsInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    txn = SavingsTransaction(memberId=input.memberId, memberName=member["name"], type="withdrawal",
                             amount=input.amount, date=input.date, description=input.description)
    await db.savings.insert_one(txn.model_dump())
    return txn


# ==================== Settings ====================

@api_router.get("/settings", response_model=Settings)
async def get_settings():
    s = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    return Settings(**s)


@api_router.put("/settings", response_model=Settings)
async def update_settings(input: SettingsUpdate, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.settings.update_one({"id": "settings"}, {"$set": update_data})
    s = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    return Settings(**s)


# ==================== Dashboard / Stats ====================

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: Member = Depends(get_current_user)):
    """Returns admin-level aggregate stats."""
    contribs = await db.contributions.find({"status": "paid"}, {"_id": 0}).to_list(5000)
    loans = await db.loans.find({"status": {"$in": ["active", "completed"]}}, {"_id": 0}).to_list(2000)
    pending_loans = await db.loans.find({"status": "pending"}, {"_id": 0}).to_list(2000)
    penalties = await db.penalties.find({}, {"_id": 0}).to_list(5000)
    savings_txns = await db.savings.find({}, {"_id": 0}).to_list(5000)
    total_collection = sum(c["amount"] for c in contribs)
    total_loans_given = sum(l["amount"] for l in loans)
    total_penalty = sum(p["amount"] for p in penalties)
    total_interest = sum(l.get("totalInterest", 0) for l in loans if l.get("includeInApp", True))
    total_savings = sum(t["amount"] if t["type"] == "deposit" else -t["amount"] for t in savings_txns)
    remaining_balance = total_collection - total_loans_given + sum(
        sum(e.get("amount", 0) for e in l.get("emiHistory", []) if e.get("status") == "paid") for l in loans
    )
    return {
        "totalCollection": round(total_collection, 2),
        "totalLoansGiven": round(total_loans_given, 2),
        "remainingBalance": round(remaining_balance, 2),
        "totalPenalty": round(total_penalty, 2),
        "totalInterest": round(total_interest, 2),
        "totalSavings": round(total_savings, 2),
        "pendingLoansCount": len(pending_loans),
        "activeLoansCount": len([l for l in loans if l["status"] == "active"]),
    }


@api_router.get("/members/{member_id}/stats")
async def member_stats(member_id: str, user: Member = Depends(get_current_user)):
    if user.id != member_id and not user.isAdmin:
        raise HTTPException(status_code=403, detail="Forbidden")
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Not found")

    # Member's contribution total
    member_contribs = await db.contributions.find({"memberId": member_id, "status": "paid"}, {"_id": 0}).to_list(500)
    total_contribution = sum(c["amount"] for c in member_contribs)

    # All non-admin active members' total contribution
    all_members = await db.members.find({"isAdmin": False, "isActive": True}, {"_id": 0}).to_list(100)
    all_member_ids = [m["id"] for m in all_members]
    all_contribs = await db.contributions.find({"memberId": {"$in": all_member_ids}, "status": "paid"}, {"_id": 0}).to_list(5000)
    total_all_contribs = sum(c["amount"] for c in all_contribs)

    # Determine member contribution for share (admin gets average)
    is_admin = member.get("isAdmin", False)
    if is_admin:
        share_contrib = total_all_contribs / len(all_members) if all_members else 0
    else:
        share_contrib = total_contribution

    # Only events after member's joining date
    joining = member["joiningDate"]
    # Penalties
    penalties = await db.penalties.find({}, {"_id": 0}).to_list(5000)
    rel_penalties = [p for p in penalties if p["date"][:10] >= joining[:10]]
    total_penalty = sum(p["amount"] for p in rel_penalties)
    penalty_share = round((share_contrib / total_all_contribs) * total_penalty, 2) if total_all_contribs else 0

    # Loans interest (loans opened after joining)
    loans = await db.loans.find({"status": {"$in": ["active", "completed"]}, "includeInApp": True}, {"_id": 0}).to_list(2000)
    rel_loans = [l for l in loans if l["openingDate"][:10] >= joining[:10]]
    total_interest = sum(l.get("totalInterest", 0) for l in rel_loans)
    interest_share = round((share_contrib / total_all_contribs) * total_interest, 2) if total_all_contribs else 0

    # Member loans
    member_loans = await db.loans.find({"memberId": member_id}, {"_id": 0}).to_list(100)

    # Savings balance
    savings = await db.savings.find({"memberId": member_id}, {"_id": 0}).to_list(500)
    savings_balance = sum(t["amount"] if t["type"] == "deposit" else -t["amount"] for t in savings)

    # Next due date - next unpaid contribution month
    now = datetime.now()
    current_month_key = f"{now.year}-{now.month:02d}"
    paid_months = {c["month"] for c in member_contribs}

    total_earnings = penalty_share + interest_share
    grand_total = total_contribution + total_earnings

    # Can apply loan?
    can_apply = True
    active_loans = [l for l in member_loans if l["status"] in ["active", "pending"]]
    for l in active_loans:
        paid = sum(1 for e in l["emiHistory"] if e["status"] == "paid")
        if paid < math.ceil(l["months"] / 2):
            can_apply = False
            break

    return {
        "memberId": member_id,
        "totalContribution": round(total_contribution, 2),
        "penaltyShare": penalty_share,
        "interestShare": interest_share,
        "totalEarnings": round(total_earnings, 2),
        "grandTotal": round(grand_total, 2),
        "savingsBalance": round(savings_balance, 2),
        "currentMonth": current_month_key,
        "paidMonths": sorted(list(paid_months)),
        "canApplyLoan": can_apply,
        "loansCount": len(member_loans),
    }


@api_router.get("/defaulters")
async def get_defaulters(user: Member = Depends(get_current_user)):
    members = await db.members.find({"isAdmin": False, "isActive": True}, {"_id": 0}).to_list(100)
    now = datetime.now()
    current_month_key = f"{now.year}-{now.month:02d}"
    defaulters = []
    for m in members:
        contribs = await db.contributions.find({"memberId": m["id"], "status": "paid"}, {"_id": 0}).to_list(200)
        paid_months = {c["month"] for c in contribs}
        # Required months from joining to current
        join_date = datetime.strptime(m["joiningDate"][:10], "%Y-%m-%d")
        cursor = datetime(join_date.year, join_date.month, 1)
        is_defaulter = False
        while cursor < datetime(now.year, now.month, 1):
            month_key = f"{cursor.year}-{cursor.month:02d}"
            if month_key not in paid_months:
                is_defaulter = True
                break
            if cursor.month == 12:
                cursor = datetime(cursor.year + 1, 1, 1)
            else:
                cursor = datetime(cursor.year, cursor.month + 1, 1)
        if is_defaulter:
            defaulters.append({"id": m["id"], "name": m["name"]})
    return defaulters


# ==================== CSV Export ====================

@api_router.get("/csv/all")
async def csv_all(user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    members = await db.members.find({}, {"_id": 0}).to_list(100)
    contribs = await db.contributions.find({}, {"_id": 0}).to_list(5000)
    loans = await db.loans.find({}, {"_id": 0}).to_list(2000)
    csv = "SHG BANK - Full Report\n\n--- Members ---\nName,Mobile,Joining Date,Active\n"
    for m in members:
        csv += f"{m['name']},{m['mobile']},{m['joiningDate']},{m.get('isActive', True)}\n"
    csv += "\n--- Contributions ---\nName,Month,Amount,Status,Penalty,PaidDate\n"
    for c in contribs:
        csv += f"{c['memberName']},{c['month']},{c['amount']},{c['status']},{c.get('penalty', 0)},{c.get('paidDate', '')}\n"
    csv += "\n--- Loans ---\nName,Amount,Months,Interest,Total,Status,OpeningDate\n"
    for l in loans:
        csv += f"{l['memberName']},{l['amount']},{l['months']},{l.get('totalInterest', 0)},{l.get('totalPayable', 0)},{l['status']},{l['openingDate'][:10]}\n"
    return {"csv": csv}


# ==================== Health ====================

@api_router.get("/")
async def root():
    return {"message": "SHG BANK API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
