export interface Member {
  id: string;
  name: string;
  mobile: string;
  password: string;
  joiningDate: string;
  profilePhoto?: string;
  isAdmin: boolean;
  isActive: boolean;
  language?: 'hi' | 'en' | 'ta';
}

export interface Loan {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  interestRate: number;
  months: number;
  totalInterest: number;
  totalPayable: number;
  emiAmount: number;
  remainingAmount: number;
  openingDate: string;
  closingDate: string;
  nextEmiDate: string;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'recalled' | 'rejected';
  includeInterest: boolean;
  isOldLoan: boolean;
  emiHistory: EMIRecord[];
}

export interface EMIRecord {
  id: string;
  loanId: string;
  memberId: string;
  emiNumber: number;
  amount: number;
  interestComponent: number;
  principalComponent: number;
  dueDate: string;
  paidDate?: string;
  penalty: number;
  status: 'paid' | 'pending' | 'overdue';
  approvedByMember: boolean;
}

export interface Contribution {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  month: string;
  dueDate: string;
  paidDate?: string;
  penalty: number;
  status: 'paid' | 'pending' | 'overdue';
  approvedByMember: boolean;
}

export interface PenaltyRecord {
  id: string;
  memberId: string;
  type: 'contribution' | 'emi';
  referenceId: string;
  amount: number;
  date: string;
  daysLate: number;
}

export interface AppSettings {
  upiId: string;
  groupName: string;
  monthlyContribution: number;
  maxLoanAmount: number;
  interestRate: number;
  lateFeePerDay: number;
  dueDate: number;
}

export interface Notification {
  id: string;
  targetMemberId?: string;
  message: string;
  date: string;
  type: 'broadcast' | 'loan_holder';
}

export interface MemberShare {
  memberId: string;
  penaltyEarnings: number;
  interestEarnings: number;
  totalEarnings: number;
  totalContribution: number;
  grandTotal: number;
}
