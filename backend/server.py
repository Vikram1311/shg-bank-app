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
    isPersonal: bool = False
    guarantorId: Optional[str] = None
    guarantorName: Optional[str] = None
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
    type: Literal["contribution", "emi", "manual"]
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
    status: Literal["pending", "approved"] = "approved"
    createdBy: Literal["member", "admin"] = "admin"


class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    memberId: str
    message: str
    type: str = "penalty"  # penalty | savings_approved | savings_rejected | loan | general
    date: str
    read: bool = False
    referenceId: Optional[str] = None


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    upiId: str = "9315341037@INDIE"
    groupName: str = "SHG BANK"
    monthlyContribution: float = 1000
    maxLoanAmount: float = 15000
    maxLoanAmountWithGuarantor: float = 30000
    interestRate: float = 2
    lateFeePerDay: float = 10
    dueDate: int = 11
    penaltyStartDate: str = "2026-06-10"  # Pending penalty calc only counts months on/after this
    savingsInterestRate: float = 7.25  # Annual % on savings balance


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
    joiningDate: Optional[str] = None


class AddMemberInput(BaseModel):
    name: str
    mobile: str
    joiningDate: str


class LoanApplyInput(BaseModel):
    memberId: str
    amount: float
    months: int
    guarantorId: Optional[str] = None


class EMIPayInput(BaseModel):
    loanId: str
    emiNumber: int
    paidDate: str
    applyPenalty: bool = True
    flexibleAmount: Optional[float] = None  # If provided, overrides EMI amount


class EMIEditInput(BaseModel):
    amount: Optional[float] = None
    paidDate: Optional[str] = None
    dueDate: Optional[str] = None
    penalty: Optional[float] = None
    status: Optional[Literal["pending", "paid"]] = None


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


class PersonalLoanInput(BaseModel):
    memberId: str
    amount: float
    months: int
    interestRate: float = 2
    openingDate: str
    closingDate: Optional[str] = None
    description: str = ""


class SettingsUpdate(BaseModel):
    upiId: Optional[str] = None
    groupName: Optional[str] = None
    monthlyContribution: Optional[float] = None
    maxLoanAmount: Optional[float] = None
    maxLoanAmountWithGuarantor: Optional[float] = None
    interestRate: Optional[float] = None
    lateFeePerDay: Optional[float] = None
    penaltyStartDate: Optional[str] = None
    savingsInterestRate: Optional[float] = None


class ContributionUpdate(BaseModel):
    amount: Optional[float] = None
    paidDate: Optional[str] = None
    penalty: Optional[float] = None
    status: Optional[str] = None


class SavingsUpdate(BaseModel):
    amount: Optional[float] = None
    date: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None


class LoanUpdate(BaseModel):
    status: Optional[str] = None
    includeInApp: Optional[bool] = None
    closingDate: Optional[str] = None


class ManualPenaltyInput(BaseModel):
    memberId: str
    type: str = "manual"  # manual | contribution | emi
    amount: float
    daysLate: int = 0
    date: str
    description: str = ""


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


async def is_member_blocked_as_guarantor(member_id: str) -> bool:
    """Returns True if member is currently a guarantor on an active loan with < 75% paid."""
    active_loans = await db.loans.find(
        {"guarantorId": member_id, "status": {"$in": ["pending", "active"]}},
        {"_id": 0},
    ).to_list(100)
    for loan in active_loans:
        paid_amount = sum((e.get("amount", 0) for e in loan["emiHistory"] if e["status"] == "paid"))
        total = loan.get("totalPayable", 0) or 1
        if (paid_amount / total) < 0.75:
            return True
    return False


async def notify(member_id: str, message: str, notif_type: str = "general", ref_id: Optional[str] = None) -> None:
    """Create a notification for a member."""
    n = Notification(
        memberId=member_id,
        message=message,
        type=notif_type,
        date=datetime.now().isoformat(),
        referenceId=ref_id,
    )
    await db.notifications.insert_one(n.model_dump())


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
    # Check max with guarantor
    if input.amount > settings.maxLoanAmountWithGuarantor:
        raise HTTPException(status_code=400, detail=f"Max loan ₹{settings.maxLoanAmountWithGuarantor}")
    needs_guarantor = input.amount > settings.maxLoanAmount
    if needs_guarantor and not input.guarantorId:
        raise HTTPException(status_code=400, detail=f"Loans above ₹{settings.maxLoanAmount} require a guarantor")
    if input.months < 1 or input.months > 6:
        raise HTTPException(status_code=400, detail="Months must be 1-6")

    # Eligibility: 50% of previous loan must be paid
    active_loans = await db.loans.find({"memberId": input.memberId, "status": {"$in": ["active", "pending"]}}, {"_id": 0}).to_list(50)
    for loan_doc in active_loans:
        paid = sum(1 for e in loan_doc["emiHistory"] if e["status"] == "paid")
        if paid < math.ceil(loan_doc["months"] / 2):
            raise HTTPException(status_code=400, detail="Previous loan: 50% payment pending")

    # Block if currently a guarantor on another active loan with <75% paid
    if await is_member_blocked_as_guarantor(input.memberId):
        raise HTTPException(status_code=400, detail="You are currently a guarantor on an active loan (<75% repaid). Cannot apply for new loan.")

    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    guarantor_name = None
    if input.guarantorId:
        if input.guarantorId == input.memberId:
            raise HTTPException(status_code=400, detail="Cannot be your own guarantor")
        guarantor = await db.members.find_one({"id": input.guarantorId}, {"_id": 0})
        if not guarantor:
            raise HTTPException(status_code=400, detail="Guarantor not found")
        # Check guarantor not already blocked
        blocked = await is_member_blocked_as_guarantor(input.guarantorId)
        if blocked:
            raise HTTPException(status_code=400, detail="Selected guarantor is currently guaranteeing another active loan")
        guarantor_name = guarantor["name"]

    rate = settings.interestRate / 100
    details = calculate_loan_details(input.amount, input.months, rate)
    now = datetime.now()
    closing_date = (datetime(now.year + (now.month + input.months - 1) // 12, ((now.month + input.months - 1) % 12) + 1, min(now.day, 28))).isoformat()

    emi_history = []
    for i, b in enumerate(details["breakdown"]):
        # First EMI is due NEXT month from loan opening (not the same month)
        due_month = now.month + i + 1
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
        guarantorId=input.guarantorId,
        guarantorName=guarantor_name,
        emiHistory=emi_history,
    )
    await db.loans.insert_one(loan.model_dump())
    return loan


@api_router.post("/loans/{loan_id}/approve")
async def approve_loan(loan_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    await db.loans.update_one({"id": loan_id}, {"$set": {"status": "active"}})
    await notify(loan["memberId"], f"✅ आपका ₹{loan.get('amount', 0)} का ऋण स्वीकृत हो गया", "loan_approved", loan_id)
    return {"success": True}


@api_router.post("/loans/{loan_id}/reject")
async def reject_loan(loan_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    await db.loans.update_one({"id": loan_id}, {"$set": {"status": "rejected"}})
    await notify(loan["memberId"], f"❌ आपका ₹{loan.get('amount', 0)} का ऋण अस्वीकृत हुआ", "loan_rejected", loan_id)
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
        # First EMI due NEXT month from opening date (not same month)
        due_month = opening.month + i + 1
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
    # Allow custom flexible payment amount
    actual_amount = input.flexibleAmount if input.flexibleAmount and input.flexibleAmount > 0 else target_emi["amount"]
    target_emi["status"] = "paid"
    target_emi["paidDate"] = input.paidDate
    target_emi["penalty"] = penalty
    target_emi["amount"] = actual_amount  # Store actual paid amount
    # Remaining = sum of pending EMI amounts (truly what's left to pay)
    new_remaining = round(sum(e["amount"] for e in emi_history if e["status"] == "pending"), 2)
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
    # Notify member
    msg = f"💰 आपका EMI #{input.emiNumber} ₹{actual_amount} जमा हुआ"
    if penalty > 0:
        msg += f" (₹{penalty} जुर्माना सहित)"
    await notify(loan["memberId"], msg, "emi_paid", input.loanId)
    return {"success": True, "penalty": penalty, "actualAmount": actual_amount}


@api_router.put("/loans/{loan_id}/emi/{emi_id}")
async def edit_emi(loan_id: str, emi_id: str, input: EMIEditInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    emi_history = loan["emiHistory"]
    target_emi = None
    for e in emi_history:
        if e["id"] == emi_id:
            target_emi = e
            break
    if not target_emi:
        raise HTTPException(status_code=404, detail="EMI not found")

    old_penalty = target_emi.get("penalty", 0)
    update_fields = {k: v for k, v in input.model_dump().items() if v is not None}
    target_emi.update(update_fields)

    # ---- Sync PenaltyRecord with edited penalty ----
    new_penalty = target_emi.get("penalty", 0) or 0
    if new_penalty != old_penalty:
        existing_pen = await db.penalties.find_one({"referenceId": emi_id, "type": "emi"}, {"_id": 0})
        if new_penalty > 0:
            # Compute days_late from due date
            due_str = target_emi.get("dueDate", "")
            try:
                days_late = calculate_penalty_days(due_str)
            except Exception:
                days_late = 0
            penalty_date = target_emi.get("paidDate") or datetime.now().date().isoformat()
            if existing_pen:
                await db.penalties.update_one(
                    {"referenceId": emi_id, "type": "emi"},
                    {"$set": {"amount": new_penalty, "date": penalty_date, "daysLate": days_late}},
                )
            else:
                p = PenaltyRecord(
                    memberId=loan["memberId"], type="emi", referenceId=emi_id,
                    amount=new_penalty, date=penalty_date, daysLate=days_late,
                )
                await db.penalties.insert_one(p.model_dump())
        else:
            # Penalty cleared → remove record
            if existing_pen:
                await db.penalties.delete_many({"referenceId": emi_id, "type": "emi"})

    # Recompute remaining amount = sum of pending EMIs
    new_remaining = round(sum(e["amount"] for e in emi_history if e["status"] == "pending"), 2)
    all_paid = all(e["status"] == "paid" for e in emi_history)
    # Preserve original status for pending/rejected/recalled loans
    if loan["status"] in ("pending", "rejected", "recalled"):
        new_status = loan["status"]
    else:
        new_status = "completed" if all_paid else "active"
    await db.loans.update_one({"id": loan_id}, {"$set": {
        "emiHistory": emi_history,
        "remainingAmount": new_remaining,
        "status": new_status,
    }})
    return {"success": True, "emi": target_emi}


@api_router.delete("/loans/{loan_id}")
async def delete_loan(loan_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    # Get loan first for cascade cleanup
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    # Cascade: remove any EMI-late penalties tied to this loan's EMIs
    emi_ids = [e["id"] for e in loan.get("emiHistory", []) if "id" in e]
    if emi_ids:
        await db.penalties.delete_many({"type": "emi", "referenceId": {"$in": emi_ids}})
    await db.loans.delete_one({"id": loan_id})
    return {"success": True, "memberName": loan.get("memberName"), "amount": loan.get("amount")}


@api_router.post("/personal-loans", response_model=Loan)
async def add_personal_loan(input: PersonalLoanInput, user: Member = Depends(get_current_user)):
    """Personal loan - not tied to group's interest sharing."""
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    rate = input.interestRate / 100
    details = calculate_loan_details(input.amount, input.months, rate)
    is_closed = bool(input.closingDate)
    opening = datetime.strptime(input.openingDate[:10], "%Y-%m-%d")
    emi_history = []
    for i, b in enumerate(details["breakdown"]):
        due_month = opening.month + i + 1
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
    next_emi_date = emi_history[0].dueDate if emi_history else opening.isoformat()
    loan = Loan(
        memberId=input.memberId,
        memberName=member["name"],
        amount=input.amount,
        interestRate=input.interestRate,
        months=input.months,
        totalInterest=details["totalInterest"],
        totalPayable=details["totalPayable"],
        emiAmount=details["emi"],
        remainingAmount=0 if is_closed else details["totalPayable"],
        openingDate=input.openingDate,
        closingDate=input.closingDate or "",
        nextEmiDate=next_emi_date,
        status="completed" if is_closed else "active",
        isOldLoan=False,
        includeInApp=False,  # personal loans don't share interest
        isPersonal=True,
        emiHistory=emi_history,
    )
    await db.loans.insert_one(loan.model_dump())
    await notify(input.memberId, f"💼 आपके लिए ₹{input.amount} का व्यक्तिगत ऋण जोड़ा गया", "personal_loan", loan.id)
    return loan


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
    # Notify
    msg = f"✅ आपका {input.month} का योगदान ₹{settings_doc['monthlyContribution']} जमा हुआ"
    if penalty > 0:
        msg += f" (₹{penalty} जुर्माना सहित)"
    await notify(input.memberId, msg, "contribution_added", contribution.id)
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


@api_router.put("/contributions/{contrib_id}")
async def edit_contribution(contrib_id: str, input: ContributionUpdate, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.contributions.update_one({"id": contrib_id}, {"$set": update_data})
    c = await db.contributions.find_one({"id": contrib_id}, {"_id": 0})
    return c


# ==================== Penalty / Savings ====================

@api_router.get("/penalties", response_model=List[PenaltyRecord])
async def get_penalties(user: Member = Depends(get_current_user)):
    pens = await db.penalties.find({}, {"_id": 0}).to_list(2000)
    return [PenaltyRecord(**p) for p in pens]


@api_router.post("/penalties")
async def add_manual_penalty(input: ManualPenaltyInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    p = PenaltyRecord(
        memberId=input.memberId,
        type=input.type if input.type in ("contribution", "emi") else "manual",
        referenceId=str(uuid.uuid4()),
        amount=input.amount,
        date=input.date,
        daysLate=input.daysLate,
    )
    await db.penalties.insert_one(p.model_dump())
    desc = f" ({input.description})" if input.description else ""
    await notify(input.memberId, f"⚠️ आप पर ₹{input.amount} का जुर्माना लगाया गया{desc}", "penalty_added", p.id)
    return p


@api_router.delete("/penalties/{penalty_id}")
async def delete_penalty(penalty_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    pen = await db.penalties.find_one({"id": penalty_id}, {"_id": 0})
    if not pen:
        raise HTTPException(status_code=404, detail="Not found")
    await db.penalties.delete_one({"id": penalty_id})
    await notify(pen["memberId"], f"✅ आप पर लगाया गया ₹{pen['amount']} का जुर्माना हटाया गया", "penalty_removed", penalty_id)
    return {"success": True}


@api_router.get("/savings")
async def get_savings(memberId: Optional[str] = None, user: Member = Depends(get_current_user)):
    query = {}
    if memberId:
        query["memberId"] = memberId
    elif not user.isAdmin:
        query["memberId"] = user.id
    txns = await db.savings.find(query, {"_id": 0}).to_list(2000)
    return txns


@api_router.get("/savings/balance/{member_id}")
async def savings_balance(member_id: str, user: Member = Depends(get_current_user)):
    if user.id != member_id and not user.isAdmin:
        raise HTTPException(status_code=403, detail="Forbidden")
    # Only count approved transactions
    txns = await db.savings.find({"memberId": member_id, "status": "approved"}, {"_id": 0}).to_list(2000)
    balance = sum(t["amount"] if t["type"] == "deposit" else -t["amount"] for t in txns)
    pending = await db.savings.find({"memberId": member_id, "status": "pending"}, {"_id": 0}).to_list(2000)
    pending_amount = sum(t["amount"] for t in pending if t["type"] == "deposit")
    return {"memberId": member_id, "balance": round(balance, 2), "pendingAmount": round(pending_amount, 2), "pendingCount": len(pending)}


@api_router.post("/savings/deposit")
async def savings_deposit(input: SavingsInput, user: Member = Depends(get_current_user)):
    # Allow self-deposit or admin
    if user.id != input.memberId and not user.isAdmin:
        raise HTTPException(status_code=403, detail="Forbidden")
    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    # Member self-deposit → pending; admin → approved
    is_self = user.id == input.memberId and not user.isAdmin
    txn = SavingsTransaction(
        memberId=input.memberId,
        memberName=member["name"],
        type="deposit",
        amount=input.amount,
        date=input.date,
        description=input.description,
        status="pending" if is_self else "approved",
        createdBy="member" if is_self else "admin",
    )
    await db.savings.insert_one(txn.model_dump())
    if not is_self:
        await notify(input.memberId, f"💚 आपके बचत खाते में ₹{input.amount} जमा हुआ", "savings_credit", txn.id)
    return txn


@api_router.post("/savings/{txn_id}/approve")
async def approve_savings(txn_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    txn = await db.savings.find_one({"id": txn_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.savings.update_one({"id": txn_id}, {"$set": {"status": "approved"}})
    # Create notification
    n = Notification(
        memberId=txn["memberId"],
        message=f"आपकी ₹{txn['amount']} की बचत जमा स्वीकृत हो गई",
        type="savings_approved",
        date=datetime.now().isoformat(),
        referenceId=txn_id,
    )
    await db.notifications.insert_one(n.model_dump())
    return {"success": True}


@api_router.post("/savings/{txn_id}/reject")
async def reject_savings(txn_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    txn = await db.savings.find_one({"id": txn_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.savings.delete_one({"id": txn_id})
    n = Notification(
        memberId=txn["memberId"],
        message=f"आपकी ₹{txn['amount']} की बचत जमा अस्वीकृत हुई",
        type="savings_rejected",
        date=datetime.now().isoformat(),
        referenceId=txn_id,
    )
    await db.notifications.insert_one(n.model_dump())
    return {"success": True}


@api_router.post("/savings/withdraw")
async def savings_withdraw(input: SavingsInput, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    member = await db.members.find_one({"id": input.memberId}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    # Balance check (approved only)
    txns = await db.savings.find({"memberId": input.memberId, "status": "approved"}, {"_id": 0}).to_list(2000)
    balance = sum(t["amount"] if t["type"] == "deposit" else -t["amount"] for t in txns)
    if input.amount > balance:
        raise HTTPException(status_code=400, detail=f"Insufficient balance (₹{balance})")
    txn = SavingsTransaction(memberId=input.memberId, memberName=member["name"], type="withdrawal",
                             amount=input.amount, date=input.date, description=input.description,
                             status="approved", createdBy="admin")
    await db.savings.insert_one(txn.model_dump())
    await notify(input.memberId, f"🔴 आपके बचत खाते से ₹{input.amount} निकाला गया", "savings_debit", txn.id)
    return txn


@api_router.put("/savings/{txn_id}")
async def edit_savings(txn_id: str, input: SavingsUpdate, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.savings.update_one({"id": txn_id}, {"$set": update_data})
    t = await db.savings.find_one({"id": txn_id}, {"_id": 0})
    return t


@api_router.delete("/savings/{txn_id}")
async def delete_savings(txn_id: str, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    await db.savings.delete_one({"id": txn_id})
    return {"success": True}


@api_router.post("/savings/distribute-interest")
async def distribute_interest_to_savings(user: Member = Depends(get_current_user)):
    """Admin: distribute each member's earned interest share into their savings account."""
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    # Calculate current interest share for each member, then transfer
    all_members = await db.members.find({"isActive": True}, {"_id": 0}).to_list(100)
    non_admin = [m for m in all_members if not m.get("isAdmin")]
    all_member_ids = [m["id"] for m in non_admin]
    all_contribs = await db.contributions.find({"memberId": {"$in": all_member_ids}, "status": "paid"}, {"_id": 0}).to_list(5000)
    total_contribs = sum(c["amount"] for c in all_contribs)
    if total_contribs <= 0:
        raise HTTPException(status_code=400, detail="No contributions yet")

    # Already-distributed marker: check via description prefix
    today = datetime.now().date().isoformat()
    transferred = []
    for m in all_members:
        joining = m["joiningDate"][:10]
        member_contribs = [c for c in all_contribs if c["memberId"] == m["id"]]
        member_total = sum(c["amount"] for c in member_contribs)
        if m.get("isAdmin"):
            share_contrib = total_contribs / len(non_admin) if non_admin else 0
        else:
            share_contrib = member_total
        if share_contrib <= 0:
            continue
        loans = await db.loans.find({"status": {"$in": ["active", "completed"]}, "includeInApp": True}, {"_id": 0}).to_list(2000)
        rel_loans = [l for l in loans if l["openingDate"][:10] >= joining]
        total_interest = sum(l.get("totalInterest", 0) for l in rel_loans)
        share = round((share_contrib / total_contribs) * total_interest, 2)
        # Subtract already-distributed interest
        existing = await db.savings.find({"memberId": m["id"], "description": {"$regex": "^Interest auto-credit"}}, {"_id": 0}).to_list(500)
        already = sum(t["amount"] for t in existing if t["type"] == "deposit")
        to_credit = round(share - already, 2)
        if to_credit > 0.01:
            txn = SavingsTransaction(
                memberId=m["id"], memberName=m["name"], type="deposit",
                amount=to_credit, date=today, description="Interest auto-credit",
            )
            await db.savings.insert_one(txn.model_dump())
            transferred.append({"memberId": m["id"], "name": m["name"], "amount": to_credit})
            await notify(m["id"], f"✨ ब्याज ₹{to_credit} आपके बचत खाते में जमा हुआ", "interest_credit", txn.id)
    return {"transferred": transferred, "totalMembers": len(transferred)}


@api_router.post("/savings/distribute-savings-interest")
async def distribute_savings_interest(user: Member = Depends(get_current_user)):
    """Admin: pay monthly portion of annual interest rate on each member's current savings balance."""
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    settings_doc = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    annual_rate = settings_doc.get("savingsInterestRate", 7.25)
    monthly_rate = annual_rate / 12 / 100
    today_iso = datetime.now().date().isoformat()
    members = await db.members.find({"isActive": True}, {"_id": 0}).to_list(100)
    transferred = []
    for m in members:
        txns = await db.savings.find({"memberId": m["id"], "status": "approved"}, {"_id": 0}).to_list(2000)
        balance = sum(t["amount"] if t["type"] == "deposit" else -t["amount"] for t in txns)
        if balance <= 0:
            continue
        # Prevent double-credit in same month
        month_key = today_iso[:7]
        existing = await db.savings.find_one({
            "memberId": m["id"],
            "description": f"Savings interest {month_key}",
        }, {"_id": 0})
        if existing:
            continue
        interest = round(balance * monthly_rate, 2)
        if interest <= 0:
            continue
        txn = SavingsTransaction(
            memberId=m["id"], memberName=m["name"], type="deposit",
            amount=interest, date=today_iso,
            description=f"Savings interest {month_key}",
        )
        await db.savings.insert_one(txn.model_dump())
        await notify(m["id"], f"💚 बचत पर मासिक ब्याज ₹{interest} ({annual_rate}%/वर्ष) जमा हुआ", "savings_interest", txn.id)
        transferred.append({"memberId": m["id"], "name": m["name"], "amount": interest})
    return {"transferred": transferred, "totalMembers": len(transferred), "monthlyRate": round(monthly_rate * 100, 4)}


# ==================== Loan extra: eligible guarantors & edit ====================

@api_router.get("/loans/eligible-guarantors/{member_id}")
async def eligible_guarantors(member_id: str, user: Member = Depends(get_current_user)):
    """Returns members who can act as guarantor for the given member."""
    members = await db.members.find({"isActive": True}, {"_id": 0}).to_list(100)
    eligible = []
    for m in members:
        if m["id"] == member_id:
            continue
        if m.get("isAdmin"):
            continue
        blocked = await is_member_blocked_as_guarantor(m["id"])
        if not blocked:
            eligible.append({"id": m["id"], "name": m["name"], "mobile": m["mobile"]})
    return eligible


@api_router.put("/loans/{loan_id}")
async def edit_loan(loan_id: str, input: LoanUpdate, user: Member = Depends(get_current_user)):
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.loans.update_one({"id": loan_id}, {"$set": update_data})
    l = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    return l


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
    loans = await db.loans.find({"status": {"$in": ["active", "completed"]}, "isPersonal": {"$ne": True}}, {"_id": 0}).to_list(2000)
    personal_loans = await db.loans.find({"isPersonal": True}, {"_id": 0}).to_list(500)
    pending_loans = await db.loans.find({"status": "pending"}, {"_id": 0}).to_list(2000)
    pending_savings = await db.savings.find({"status": "pending", "type": "deposit"}, {"_id": 0}).to_list(500)
    penalties = await db.penalties.find({}, {"_id": 0}).to_list(5000)
    savings_txns = await db.savings.find({"status": "approved"}, {"_id": 0}).to_list(5000)
    total_collection = sum(c["amount"] for c in contribs)
    total_loans_given = sum(l["amount"] for l in loans)
    total_personal_loans = sum(l["amount"] for l in personal_loans)
    total_penalty = sum(p["amount"] for p in penalties)
    total_interest = sum(l.get("totalInterest", 0) for l in loans if l.get("includeInApp", True))
    total_savings = sum(t["amount"] if t["type"] == "deposit" else -t["amount"] for t in savings_txns)
    remaining_balance = total_collection - total_loans_given + sum(
        sum(e.get("amount", 0) for e in l.get("emiHistory", []) if e.get("status") == "paid") for l in loans
    )
    pending_savings_amount = sum(t["amount"] for t in pending_savings)
    return {
        "totalCollection": round(total_collection, 2),
        "totalLoansGiven": round(total_loans_given, 2),
        "totalPersonalLoans": round(total_personal_loans, 2),
        "remainingBalance": round(remaining_balance, 2),
        "totalPenalty": round(total_penalty, 2),
        "totalInterest": round(total_interest, 2),
        "totalSavings": round(total_savings, 2),
        "pendingLoansCount": len(pending_loans),
        "activeLoansCount": len([l for l in loans if l["status"] == "active"]),
        "pendingSavingsCount": len(pending_savings),
        "pendingSavingsAmount": round(pending_savings_amount, 2),
    }


@api_router.get("/members/{member_id}/stats")
async def member_stats(member_id: str, user: Member = Depends(get_current_user)):
    if user.id != member_id and not user.isAdmin:
        raise HTTPException(status_code=403, detail="Forbidden")
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Not found")

    # Member's contribution total (gross, before own-penalty deduction)
    member_contribs = await db.contributions.find({"memberId": member_id, "status": "paid"}, {"_id": 0}).to_list(500)
    gross_contribution = sum(c["amount"] for c in member_contribs)

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
        share_contrib = gross_contribution

    # Only events after member's joining date
    joining = member["joiningDate"]
    # Penalties
    penalties = await db.penalties.find({}, {"_id": 0}).to_list(5000)
    rel_penalties = [p for p in penalties if p["date"][:10] >= joining[:10]]
    total_penalty = sum(p["amount"] for p in rel_penalties)
    penalty_share = round((share_contrib / total_all_contribs) * total_penalty, 2) if total_all_contribs else 0

    # PRD #10: Member's own penalty records reduce their effective contribution.
    # (Live `pending_penalty` is also deducted below, after it is computed.)
    own_penalty_paid = sum(
        p["amount"] for p in penalties
        if p["memberId"] == member_id and p["date"][:10] >= joining[:10]
    )

    # Loans interest (loans opened after joining, excluding personal loans)
    loans = await db.loans.find({"status": {"$in": ["active", "completed"]}, "includeInApp": True, "isPersonal": {"$ne": True}}, {"_id": 0}).to_list(2000)
    rel_loans = [l for l in loans if l["openingDate"][:10] >= joining[:10]]
    total_interest = sum(l.get("totalInterest", 0) for l in rel_loans)
    interest_share = round((share_contrib / total_all_contribs) * total_interest, 2) if total_all_contribs else 0

    # Member loans
    member_loans = await db.loans.find({"memberId": member_id}, {"_id": 0}).to_list(100)

    # Savings balance (approved only)
    savings = await db.savings.find({"memberId": member_id, "status": "approved"}, {"_id": 0}).to_list(500)
    savings_balance = sum(t["amount"] if t["type"] == "deposit" else -t["amount"] for t in savings)
    pending_savings_docs = await db.savings.find({"memberId": member_id, "status": "pending", "type": "deposit"}, {"_id": 0}).to_list(500)
    pending_savings = sum(t["amount"] for t in pending_savings_docs)

    # Next due date - next unpaid contribution month
    now = datetime.now()
    current_month_key = f"{now.year}-{now.month:02d}"
    paid_months = {c["month"] for c in member_contribs}

    # ====== Pending Penalty (currently accruing) ======
    settings_doc = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    fee_per_day = settings_doc["lateFeePerDay"]
    penalty_start_str = settings_doc.get("penaltyStartDate", "2026-03-10")
    try:
        penalty_start = datetime.strptime(penalty_start_str[:10], "%Y-%m-%d")
    except Exception:
        penalty_start = datetime(2026, 3, 10)
    pending_penalty = 0
    pending_penalty_items = []

    if not is_admin:
        # All months from joining to current that are missing
        join_date = datetime.strptime(member["joiningDate"][:10], "%Y-%m-%d")
        # Use the later of joining and penaltyStartDate
        effective_start = max(join_date, datetime(penalty_start.year, penalty_start.month, 1))
        cursor = datetime(effective_start.year, effective_start.month, 1)
        while cursor <= now:
            mkey = f"{cursor.year}-{cursor.month:02d}"
            if mkey not in paid_months:
                due_day = datetime(cursor.year, cursor.month, 11, 23, 59, 59)
                if due_day < penalty_start:
                    pass  # skip — before grace start
                elif now > due_day:
                    days_late = math.ceil((now - due_day).total_seconds() / 86400)
                    p = days_late * fee_per_day
                    pending_penalty += p
                    pending_penalty_items.append({
                        "type": "contribution",
                        "month": mkey,
                        "daysLate": days_late,
                        "amount": p,
                    })
            if cursor.month == 12:
                cursor = datetime(cursor.year + 1, 1, 1)
            else:
                cursor = datetime(cursor.year, cursor.month + 1, 1)

        # Check unpaid EMIs past due date (only after penaltyStartDate; skip personal loans)
        for ml in member_loans:
            if ml["status"] not in ["active"]:
                continue
            if ml.get("isPersonal"):
                # Personal loans not part of group penalty pool
                continue
            for emi in ml.get("emiHistory", []):
                if emi["status"] == "pending":
                    due_str = emi["dueDate"][:10]
                    try:
                        due_dt = datetime.strptime(due_str, "%Y-%m-%d")
                    except Exception:
                        try:
                            due_dt = datetime.fromisoformat(emi["dueDate"].replace("Z", "+00:00")).replace(tzinfo=None)
                        except Exception:
                            continue
                    due_end = datetime(due_dt.year, due_dt.month, 11, 23, 59, 59)
                    if due_end < penalty_start:
                        continue  # skip — before grace start
                    if now > due_end:
                        days_late = math.ceil((now - due_end).total_seconds() / 86400)
                        same_month_key = f"{due_dt.year}-{due_dt.month:02d}"
                        rate_per_day = fee_per_day * 2 if same_month_key not in paid_months and same_month_key != current_month_key else fee_per_day
                        p = days_late * rate_per_day
                        pending_penalty += p
                        pending_penalty_items.append({
                            "type": "emi",
                            "loanId": ml["id"],
                            "emiNumber": emi["emiNumber"],
                            "daysLate": days_late,
                            "amount": p,
                        })

    pending_penalty = round(pending_penalty, 2)

    # PRD #10 + user request: Auto-deduct BOTH already-recorded penalties AND
    # live accruing pending_penalty from this month's 12th onwards.
    # This makes the member's displayed contribution shrink daily while they are late,
    # without waiting for admin to manually record the payment.
    total_contribution = max(0, gross_contribution - own_penalty_paid - pending_penalty)
    total_earnings = penalty_share + interest_share
    grand_total = total_contribution + total_earnings

    # Auto-create notification once per day if pending_penalty > 0
    if pending_penalty > 0 and not is_admin:
        today_iso = now.date().isoformat()
        existing = await db.notifications.find_one({
            "memberId": member_id,
            "type": "penalty",
            "date": {"$regex": f"^{today_iso}"},
        }, {"_id": 0})
        if not existing:
            n = Notification(
                memberId=member_id,
                message=f"⚠️ आज तक ₹{pending_penalty} जुर्माना जमा हुआ है। कृपया जल्द भुगतान करें।",
                type="penalty",
                date=now.isoformat(),
            )
            await db.notifications.insert_one(n.model_dump())

    # Can apply loan?
    can_apply = True
    block_reason = None
    active_loans = [l for l in member_loans if l["status"] in ["active", "pending"]]
    for l in active_loans:
        paid = sum(1 for e in l["emiHistory"] if e["status"] == "paid")
        if paid < math.ceil(l["months"] / 2):
            can_apply = False
            block_reason = "previous_loan_50"
            break

    # Also block if member is currently guarantor on another active loan with <75% paid
    if can_apply:
        is_blocked = await is_member_blocked_as_guarantor(member_id)
        if is_blocked:
            can_apply = False
            block_reason = "guarantor_block_75"

    return {
        "memberId": member_id,
        "totalContribution": round(total_contribution, 2),
        "grossContribution": round(gross_contribution, 2),
        "ownPenaltyPaid": round(own_penalty_paid, 2),
        "penaltyShare": penalty_share,
        "interestShare": interest_share,
        "totalEarnings": round(total_earnings, 2),
        "grandTotal": round(grand_total, 2),
        "savingsBalance": round(savings_balance, 2),
        "pendingSavings": round(pending_savings, 2),
        "pendingPenalty": pending_penalty,
        "pendingPenaltyItems": pending_penalty_items,
        "currentMonth": current_month_key,
        "paidMonths": sorted(list(paid_months)),
        "canApplyLoan": can_apply,
        "blockReason": block_reason,
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


# ==================== Notifications ====================

@api_router.get("/members/{member_id}/full-detail")
async def member_full_detail(member_id: str, user: Member = Depends(get_current_user)):
    """Admin: complete view of one member's data"""
    if not user.isAdmin and user.id != member_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    member = await db.members.find_one({"id": member_id}, {"_id": 0, "password": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    loans = await db.loans.find({"memberId": member_id}, {"_id": 0}).to_list(200)
    contribs = await db.contributions.find({"memberId": member_id}, {"_id": 0}).to_list(500)
    savings_txns = await db.savings.find({"memberId": member_id}, {"_id": 0}).to_list(500)
    penalties = await db.penalties.find({"memberId": member_id}, {"_id": 0}).to_list(500)
    # Loans where this member is guarantor
    guarantor_loans = await db.loans.find({"guarantorId": member_id}, {"_id": 0}).to_list(200)
    return {
        "member": member,
        "loans": loans,
        "contributions": sorted(contribs, key=lambda c: c.get("month", ""), reverse=True),
        "savings": sorted(savings_txns, key=lambda s: s.get("date", ""), reverse=True),
        "penalties": penalties,
        "guarantorLoans": guarantor_loans,
    }


@api_router.get("/notifications")
async def get_notifications(user: Member = Depends(get_current_user)):
    notifs = await db.notifications.find({"memberId": user.id}, {"_id": 0}).sort("date", -1).to_list(100)
    return notifs


@api_router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: Member = Depends(get_current_user)):
    notif = await db.notifications.find_one({"id": notif_id}, {"_id": 0})
    if not notif:
        raise HTTPException(status_code=404, detail="Not found")
    if notif["memberId"] != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.notifications.update_one({"id": notif_id}, {"$set": {"read": True}})
    return {"success": True}


@api_router.post("/notifications/read-all")
async def mark_all_read(user: Member = Depends(get_current_user)):
    await db.notifications.update_many({"memberId": user.id, "read": False}, {"$set": {"read": True}})
    return {"success": True}


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

@api_router.post("/admin/clear-transactions")
async def clear_transactions(user: Member = Depends(get_current_user)):
    """Admin: Wipe all transactional data (loans, contributions, savings, penalties, notifications).
    Keeps members and settings intact."""
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    loans_count = await db.loans.count_documents({})
    contribs_count = await db.contributions.count_documents({})
    savings_count = await db.savings.count_documents({})
    penalties_count = await db.penalties.count_documents({})
    notifs_count = await db.notifications.count_documents({})
    await db.loans.delete_many({})
    await db.contributions.delete_many({})
    await db.savings.delete_many({})
    await db.penalties.delete_many({})
    await db.notifications.delete_many({})
    return {
        "success": True,
        "deleted": {
            "loans": loans_count,
            "contributions": contribs_count,
            "savings": savings_count,
            "penalties": penalties_count,
            "notifications": notifs_count,
        },
    }


@api_router.post("/admin/cleanup-orphan-penalties")
async def cleanup_orphan_penalties(user: Member = Depends(get_current_user)):
    """Admin: remove EMI/contribution penalty records whose source no longer exists."""
    if not user.isAdmin:
        raise HTTPException(status_code=403, detail="Admin only")
    # Collect valid emi ids and contribution ids
    loans = await db.loans.find({}, {"_id": 0, "emiHistory": 1}).to_list(5000)
    valid_emi_ids = set()
    for l in loans:
        for e in l.get("emiHistory", []):
            if e.get("id"):
                valid_emi_ids.add(e["id"])
    contribs = await db.contributions.find({}, {"_id": 0, "id": 1}).to_list(5000)
    valid_contrib_ids = {c["id"] for c in contribs}

    penalties = await db.penalties.find({}, {"_id": 0}).to_list(5000)
    orphan_ids = []
    details = []
    for p in penalties:
        if p.get("type") == "emi" and p.get("referenceId") and p["referenceId"] not in valid_emi_ids:
            orphan_ids.append(p["id"])
            details.append({"memberId": p.get("memberId"), "amount": p.get("amount"), "type": "emi"})
        elif p.get("type") == "contribution" and p.get("referenceId") and p["referenceId"] not in valid_contrib_ids:
            orphan_ids.append(p["id"])
            details.append({"memberId": p.get("memberId"), "amount": p.get("amount"), "type": "contribution"})
    if orphan_ids:
        await db.penalties.delete_many({"id": {"$in": orphan_ids}})
    return {"deleted": len(orphan_ids), "details": details}


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
