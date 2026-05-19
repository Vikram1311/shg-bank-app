# SHG BANK - Product Requirements Document

## Problem Statement
स्वयं सहायता समूह (Self Help Group) Banking application:
- 23 सदस्य + 1 एडमिन (Total 24)
- मासिक ₹1000 योगदान (एडमिन छूट प्राप्त)
- 2% घटता ब्याज, 1-6 EMI, अधिकतम ₹15,000 ऋण
- 11 तारीख तक भुगतान, उसके बाद ₹10/दिन जुर्माना (अगर EMI भी late तो ₹20/दिन)
- कुल ब्याज और जुर्माना सदस्यों में योगदान अनुपात में बंटे
- भुगतान UPI QR: 9315341037@INDIE
- भाषाएं: Hindi (default), English, Tamil (Ravi Arumugam के लिए)

## Architecture
- **Backend**: FastAPI + MongoDB (motor async driver). All endpoints under `/api/`.
- **Frontend**: React 19 + Tailwind 3 + Sonner (toasts) + Lucide icons. Routes via react-router.
- **Auth**: Token = member UUID; sent as `Bearer` header.
- **Theme**: Colorful 3D (Rani Pink / Marigold / Vibrant Violet). Outfit + Nunito + Devanagari/Tamil fonts. Claymorphic stats, 3D tactile buttons with depth shadow, animated background blobs.

## User Personas
- **एडमिन (N.P. Singh equivalent)**: Manages all 23 members, approves loans, enters contributions, sets penalties, exports CSV.
- **सदस्य (Members)**: View own dashboard, apply for loans with EMI calculator, see contribution history, check savings, pay via QR.

## Implemented Features (May 2026)

### Backend (`/app/backend/server.py`)
- POST `/api/auth/login` - mobile + password authentication
- POST `/api/auth/change-password` - self or admin reset
- POST `/api/auth/reset-password/{id}` - admin only
- GET/POST/PUT/DELETE `/api/members` - CRUD with admin gate
- GET `/api/members/{id}/stats` - personal contribution/penalty share/interest share/grand total
- GET `/api/loans`, POST `/api/loans/calculator`, POST `/api/loans/apply`
- POST `/api/loans/{id}/approve|reject|recall`, POST `/api/loans/emi-pay`, POST `/api/loans/old`
- POST `/api/contributions`, POST `/api/contributions/bulk`
- POST `/api/savings/deposit|withdraw`, GET `/api/savings`
- GET `/api/settings`, PUT `/api/settings`
- GET `/api/dashboard/stats` - admin aggregate
- GET `/api/defaulters` - members missing past contributions
- GET `/api/csv/all` - CSV report export
- Auto-seed: 24 members (1 admin, 23 members) + default settings on first startup
- Penalty engine: auto-calculate ₹10/day after 11th of due month
- EMI calculator: declining balance amortization with 2% monthly rate
- Loan eligibility: blocks new loan if <50% of previous loan is paid

### Frontend
- **Login** (`/pages/Login.jsx`): colorful blobs, language switcher (हिं/EN/த), 3D tactile login button
- **Admin Dashboard** (`/pages/AdminDashboard.jsx`): 5 tabs - Overview (8 stat cards + CSV export + defaulters), Loans (filter + approve/reject/pay EMI), Contributions (bulk select + history table), Members (add/remove/reset password), Settings (UPI/contribution/interest/late fee)
- **Member Dashboard** (`/pages/MemberDashboard.jsx`): 4 tabs - Overview (hero card + stats + QR code + defaulters), Loans (apply with calculator + recall), Contributions (history table), Profile (name/mobile/password)
- **LoanApplyModal**: live EMI calculator with breakdown table, slider for amount, month selector
- **QRPayment**: dynamic UPI QR generation (https://api.qrserver.com)
- **i18n**: Hindi/English/Tamil dictionary in `/lib/i18n.js`

## Testing Status (Iteration 1)
- Backend: 43/43 tests passed (100%)
- Frontend: lint clean, login page verified visually
- Minor fixes applied: savings balance validation, loan approve/reject 404

## Backlog / Next Action Items

### P0 (Important)
- Bulk SMS broadcast (admin → members or only loan-holders) — currently UI not exposed
- Profile photo upload (currently UI placeholder, no upload endpoint)
- "Add Old Loan" form in admin (endpoint exists but no UI button yet)

### P1 (Nice to have)
- Hash passwords with bcrypt (currently plaintext per spec simplicity)
- JWT tokens with expiry (currently raw UUID)
- Monthly CSV export per month (`/api/csv/monthly/{month}`)
- Member-wise CSV export
- Penalty auto-deduction from "Jama Balance"
- Interest auto-distribution to savings account on the 10th
- Festival/loan/EMI message templates

### P2 (Future enhancements)
- Twilio/SMS gateway integration for actual SMS sending
- Real-time notifications via websocket
- Charts/graphs for monthly contribution/interest trends
- Defaulter month listing (currently only names shown to members)
- Inactive member settlement flow

## Tech Notes
- Mongo collections: `members`, `loans`, `contributions`, `penalties`, `savings`, `settings`
- All amounts stored as numbers; currency formatted via Intl.NumberFormat on frontend
- DateTime stored as ISO strings; ObjectIds excluded from all responses

---
## Iteration 2 (Feb 19, 2026) - Major Feature Update

### New Features Implemented:
1. **Guarantor System (₹15K+ Loans)**
   - Member can apply for loans up to ₹30K with a guarantor
   - GET `/api/loans/eligible-guarantors/{memberId}` returns members who can guarantee
   - Guarantor is blocked from new loans until 75% of guaranteed loan is repaid
   - Frontend: LoanApplyModal shows guarantor dropdown when amount > ₹15K
   - Settings: new `maxLoanAmountWithGuarantor` field (default ₹30K)

2. **Member Savings Tab**
   - New "बचत खाता" tab on member dashboard with hero balance card
   - Members can self-deposit via POST `/api/savings/deposit` (own ID only)
   - GET `/api/savings/balance/{memberId}` returns current balance
   - Transaction history with deposit/withdrawal cards

3. **Admin Savings Tab**
   - All members' savings balances grid + filterable transaction table
   - Admin deposit/withdraw modals with member selector
   - Edit any savings transaction (amount, date, description, type)
   - Delete any transaction

4. **Interest Auto-Distribution**
   - POST `/api/savings/distribute-interest` - admin transfers each member's earned interest share to their savings account
   - Idempotent (description-based dedupe via "Interest auto-credit")
   - One-click "ब्याज वितरण" button in Admin Savings tab

5. **Old Loan Entry**
   - Admin Loans tab: "Add Old Loan" button opens modal
   - Toggle Running/Closed status
   - Configurable months, opening date, closing date, interest rate
   - Option to include in app (share interest with members)

6. **Edit/Delete on Admin**
   - PUT/DELETE on contributions, loans, savings
   - Edit buttons added to contribution rows in Contributions tab
   - Edit modal for savings in Admin Savings tab

### Testing
- Iteration 2: 31/31 backend tests passed (100%)
- Critical bug fix during testing: `guarantorId`/`guarantorName` were not being persisted on new loans → fixed in apply_loan() Loan() constructor

---
## Iteration 3 (Feb 19, 2026) - Approval Flow + Notifications + Daily Penalty

### New Features Implemented:
1. **Member Savings Approval Workflow**
   - `SavingsTransaction.status` field: pending/approved + `createdBy`: member/admin
   - Member self-deposits → status=pending (NOT counted in balance)
   - Admin deposits → status=approved
   - New endpoints: `POST /api/savings/{id}/approve`, `POST /api/savings/{id}/reject`
   - Admin sees "Pending approvals" section with one-click approve/reject buttons
   - Member sees "लंबित" (pending) badge on their deposit + pending amount counter

2. **Tamil Language Restriction**
   - Header language switcher only shows Tamil option if `user.language === 'ta'` OR user is admin
   - Login page only shows Hindi/English (no Tamil before login)
   - Ravi Arumugam (seeded with language='ta') sees Tamil option

3. **Daily Late-Fee Auto-Accrual**
   - `/api/members/{id}/stats` now returns:
     - `pendingPenalty`: total ₹ accrued daily for unpaid contributions+EMIs past 11th
     - `pendingPenaltyItems`: breakdown {type, daysLate, amount, month/loanId}
     - `pendingSavings`: sum of pending deposit amounts
   - Rate: ₹10/day for contribution, ₹20/day if contribution+EMI both late same month
   - Admin exempt (pendingPenalty=0)

4. **Notifications Inbox**
   - New `Notification` model + endpoints
   - `GET /api/notifications` - own notifications, sorted newest first
   - `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`
   - Auto-created notifications:
     - Daily penalty notification when stats fetched (deduped by date)
     - Savings approved/rejected when admin acts
   - Member Dashboard has new "सूचनाएं" card with unread badge, auto-refreshes every 30s

5. **Member Dashboard Enhancements**
   - Pending Penalty warning card (red gradient, animate-pulse) on overview with item breakdown
   - 2-column layout: Notifications + Defaulters

### Testing
- Iteration 3: 24/24 new tests passed (100%)
- 1 v2 test now obsolete (test_balance_self) - documented in PRD

---
## Iteration 4 (Feb 19, 2026) - Member Detail View + Custom EMI + More Edits

### New Features:
1. **Member Detail Modal** - Admin clicks any member row → full-screen modal with 5 tabs:
   - सारांश (Summary): all financial cards
   - ऋण: complete loan list with approve/delete actions
   - योगदान: contributions with delete
   - बचत खाता: savings transactions with delete
   - जुर्माना: penalty history
   - Edit profile inline (name/mobile/joiningDate)
   - Password reset + Member removal buttons
   - Guarantor loans section if applicable

2. **Custom EMI Amount Payment**
   - New `EMIPayModal` - admin can enter actual paid amount (different from EMI)
   - Backend: `flexibleAmount` field in `EMIPayInput`
   - E.g., if EMI=₹2650 but member pays ₹3000, admin enters ₹3000
   - Shows live diff: +₹350 अतिरिक्त (principal में जाएगा)
   - Updates remainingAmount based on actual amount

3. **More Edit/Delete Endpoints**
   - `PUT /api/loans/{loan_id}/emi/{emi_id}` - edit EMI fields (amount, paidDate, penalty, status)
   - `PUT /api/members/{id}` now accepts joiningDate
   - `GET /api/members/{id}/full-detail` aggregate endpoint (admin or self)
   - Password stripped from response (security fix)

### Testing
- Iteration 4: 16/16 backend tests passed (100%)
- Security fix during iteration: removed password from full-detail response

### Code Health
- server.py = 1370 lines (refactor to routers recommended)
- Token still raw memberId UUID (security todo)
- Plaintext passwords (security todo - implement bcrypt)
