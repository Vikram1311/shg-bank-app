import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Member, Loan, Contribution, EMIRecord, AppSettings, Notification, PenaltyRecord } from '../types';
import { generateId, getDefaultPassword, calculateLoanDetails, getMonthKey, getContributionDueDate, calculatePenaltyDays } from '../utils/calculations';

const DEFAULT_MEMBERS: Omit<Member, 'id'>[] = [
  { name: 'ADMIN', mobile: '9315341037', password: '1311', joiningDate: '2025-09-10', isAdmin: true, isActive: true, language: 'hi' },
  { name: 'KARAN', mobile: '9654662362', password: '2362', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'RAJU', mobile: '9990173980', password: '3980', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'NISHA', mobile: '9711321568', password: '1568', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'MEENA', mobile: '9289137685', password: '7685', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'REKHA', mobile: '7678253940', password: '3940', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'AMISHA', mobile: '9211984237', password: '4237', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'MADHU', mobile: '7838140223', password: '0223', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'RACHNA', mobile: '8445669184', password: '9184', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'LATESH', mobile: '7017162405', password: '2405', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'SEEMA', mobile: '7525820593', password: '0593', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'SEETA', mobile: '8303972736', password: '2736', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'POONAM', mobile: '9910466049', password: '6049', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'MUSKAN', mobile: '9935593567', password: '3567', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'AVNISH', mobile: '9654784185', password: '4185', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'ASHOK', mobile: '9354276567', password: '6567', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'RAVI ARUMUGAM', mobile: '9711891954', password: '1954', joiningDate: '2025-09-10', isAdmin: false, isActive: true, language: 'en' },
  { name: 'RAMNIWAS', mobile: '9205231995', password: '1995', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'LUCKY', mobile: '9911303276', password: '3276', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'MAHESH', mobile: '8700569722', password: '9722', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'MONI', mobile: '9958422693', password: '2693', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'CHAMAN', mobile: '9911352254', password: '2254', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'INDERJEET', mobile: '8285072541', password: '2541', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'N.P. SINGH', mobile: '9315341038', password: '1038', joiningDate: '2025-09-10', isAdmin: false, isActive: true },
  { name: 'NANDINI', mobile: '8860693105', password: '3105', joiningDate: '2026-02-10', isAdmin: false, isActive: true },
  { name: 'RUPESH', mobile: '9696418043', password: '8043', joiningDate: '2026-01-10', isAdmin: false, isActive: true },
];

const DEFAULT_SETTINGS: AppSettings = {
  upiId: '9315341037@ybl',
  groupName: 'SHG BANK',
  monthlyContribution: 1000,
  maxLoanAmount: 15000,
  interestRate: 2,
  lateFeePerDay: 10,
  dueDate: 11,
};

interface AppState {
  // Auth
  currentUserId: string | null;
  
  // Data
  members: Member[];
  loans: Loan[];
  contributions: Contribution[];
  penalties: PenaltyRecord[];
  notifications: Notification[];
  settings: AppSettings;
  language: 'hi' | 'en' | 'ta';
  
  // Auth actions
  login: (mobile: string, password: string) => Member | null;
  logout: () => void;
  changePassword: (memberId: string, newPassword: string) => void;
  resetMemberPassword: (memberId: string) => void;
  
  // Member actions
  addMember: (name: string, mobile: string, joiningDate: string) => void;
  removeMember: (memberId: string) => void;
  updateMember: (memberId: string, data: Partial<Member>) => void;
  setProfilePhoto: (memberId: string, photo: string) => void;
  
  // Loan actions
  applyForLoan: (memberId: string, amount: number, months: number) => void;
  recallLoan: (loanId: string) => void;
  approveLoan: (loanId: string) => void;
  rejectLoan: (loanId: string) => void;
  addOldLoan: (data: { memberId: string; amount: number; openingDate: string; closingDate: string | null; includeInterest: boolean; months: number; isCurrentlyRunning?: boolean }) => void;
  
  // EMI actions
  addEMIPayment: (loanId: string, emiNumber: number, paidDate: string, applyPenalty: boolean) => void;
  
  // Contribution actions
  addContribution: (memberId: string, month: string, paidDate: string, applyPenalty: boolean) => void;
  addBulkContribution: (month: string, memberIds: string[], paidDate: string, applyPenalty: boolean) => void;
  
  // Admin edit
  editContribution: (contributionId: string, data: Partial<Contribution>) => void;
  editLoan: (loanId: string, data: Partial<Loan>) => void;
  editEMI: (loanId: string, emiId: string, data: Partial<EMIRecord>) => void;
  
  // Settings
  updateSettings: (data: Partial<AppSettings>) => void;
  setLanguage: (lang: 'hi' | 'en' | 'ta') => void;
  
  // Notifications
  addNotification: (message: string, type: 'broadcast' | 'loan_holder', targetMemberId?: string) => void;
  
  // CSV Export
  exportMemberCSV: (memberId: string) => string;
  exportMonthlyCSV: (month: string) => string;
  
  // Computed getters
  getMember: (id: string) => Member | undefined;
  getMemberByMobile: (mobile: string) => Member | undefined;
  getMemberLoans: (memberId: string) => Loan[];
  getMemberContributions: (memberId: string) => Contribution[];
  getMemberTotalContribution: (memberId: string) => number;
  getMemberPenaltyShare: (memberId: string) => number;
  getMemberInterestShare: (memberId: string) => number;
  getMemberTotalEarnings: (memberId: string) => number;
  getMemberGrandTotal: (memberId: string) => number;
  getActiveLoans: () => Loan[];
  getPendingLoans: () => Loan[];
  getTotalCollection: () => number;
  getTotalLoansGiven: () => number;
  getRemainingBalance: () => number;
  getTotalPenaltyCollected: () => number;
  getTotalInterestCollected: () => number;
  getDefaulterNames: () => string[];
  canApplyLoan: (memberId: string) => boolean;
  deleteContribution: (id: string) => void;
  deleteLoan: (id: string) => void;
  addOldInterest: (data: { memberId: string; amount: number; date: string; description?: string }) => void;
  forecloseLoan: (loanId: string) => void;
  getForeclosureSummary: (loanId: string) => { loanAmount: number; interestRate: number; daysActive: number; paidEmis: number; totalEmis: number; pendingInterest: number; pendingPrincipal: number; totalSettlement: number } | null;
  setMemberInactiveStatus: (memberId: string, inactiveSince: string | null) => void;
  getMemberLoanLimit: (memberId: string) => number;
  getAdminShare: () => { totalContribution: number; interestEarnings: number; penaltyEarnings: number; sharePercent: number };
  exportAdminCSV: () => string;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      members: DEFAULT_MEMBERS.map((m, i) => ({ ...m, id: `member_${i}_${m.mobile}` })),
      loans: [],
      contributions: [],
      penalties: [],
      notifications: [],
      settings: DEFAULT_SETTINGS,
      language: 'hi',

      login: (mobile, password) => {
        const member = get().members.find(m => m.mobile === mobile && m.password === password && m.isActive);
        if (member) {
          set({ currentUserId: member.id });
          return member;
        }
        return null;
      },

      logout: () => set({ currentUserId: null }),

      changePassword: (memberId, newPassword) => {
        set(s => ({
          members: s.members.map(m => m.id === memberId ? { ...m, password: newPassword } : m),
        }));
      },

      resetMemberPassword: (memberId) => {
        const member = get().members.find(m => m.id === memberId);
        if (member) {
          get().changePassword(memberId, getDefaultPassword(member.mobile));
        }
      },

      addMember: (name, mobile, joiningDate) => {
        const newMember: Member = {
          id: generateId(),
          name,
          mobile,
          password: getDefaultPassword(mobile),
          joiningDate,
          isAdmin: false,
          isActive: true,
        };
        set(s => ({ members: [...s.members, newMember] }));
      },

      removeMember: (memberId) => {
        set(s => ({
          members: s.members.map(m => m.id === memberId ? { ...m, isActive: false } : m),
        }));
      },

      updateMember: (memberId, data) => {
        set(s => ({
          members: s.members.map(m => m.id === memberId ? { ...m, ...data } : m),
        }));
      },

      setProfilePhoto: (memberId, photo) => {
        set(s => ({
          members: s.members.map(m => m.id === memberId ? { ...m, profilePhoto: photo } : m),
        }));
      },

      applyForLoan: (memberId, amount, months) => {
        const member = get().members.find(m => m.id === memberId);
        if (!member) return;
        const details = calculateLoanDetails(amount, months);
        const now = new Date();
        const closingDate = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
        const loan: Loan = {
          id: generateId(),
          memberId,
          memberName: member.name,
          amount,
          interestRate: 2,
          months,
          totalInterest: details.totalInterest,
          totalPayable: details.totalPayable,
          emiAmount: details.emi,
          remainingAmount: details.totalPayable,
          openingDate: now.toISOString(),
          closingDate: closingDate.toISOString(),
          nextEmiDate: new Date(now.getFullYear(), now.getMonth() + 1, 11).toISOString(),
          status: 'pending',
          includeInterest: true,
          isOldLoan: false,
          emiHistory: details.breakdown.map((b, i) => ({
            id: generateId(),
            loanId: '',
            memberId,
            emiNumber: i + 1,
            amount: b.amount,
            interestComponent: b.interest,
            principalComponent: b.principal,
            dueDate: new Date(now.getFullYear(), now.getMonth() + i, 11).toISOString(),
            penalty: 0,
            status: 'pending' as const,
            approvedByMember: false,
          })),
        };
        loan.emiHistory = loan.emiHistory.map(e => ({ ...e, loanId: loan.id }));
        set(s => ({ loans: [...s.loans, loan] }));
      },

      recallLoan: (loanId) => {
        set(s => ({
          loans: s.loans.map(l => l.id === loanId ? { ...l, status: 'recalled' as const } : l),
        }));
      },

      approveLoan: (loanId) => {
        set(s => ({
          loans: s.loans.map(l => l.id === loanId ? { ...l, status: 'active' as const } : l),
        }));
      },

      rejectLoan: (loanId) => {
        set(s => ({
          loans: s.loans.map(l => l.id === loanId ? { ...l, status: 'rejected' as const } : l),
        }));
      },

      addOldLoan: ({ memberId, amount, openingDate, closingDate, includeInterest, months, isCurrentlyRunning }) => {
        const member = get().members.find(m => m.id === memberId);
        if (!member) return;
        const rate = includeInterest ? 0.02 : 0;
        const effectiveMonths = (isCurrentlyRunning || closingDate === null) ? Math.max(1, months) : months;
        const details = calculateLoanDetails(amount, effectiveMonths, rate);
        const loan: Loan = {
          id: generateId(),
          memberId,
          memberName: member.name,
          amount,
          interestRate: includeInterest ? 2 : 0,
          months: effectiveMonths,
          totalInterest: includeInterest ? details.totalInterest : 0,
          totalPayable: details.totalPayable,
          emiAmount: details.emi,
          remainingAmount: details.totalPayable,
          openingDate,
          closingDate: (isCurrentlyRunning || closingDate === null) ? null : closingDate,
          nextEmiDate: new Date(new Date(openingDate).getFullYear(), new Date(openingDate).getMonth() + 1, 11).toISOString(),
          status: 'active',
          includeInterest,
          isOldLoan: true,
          emiHistory: (isCurrentlyRunning || closingDate === null) ? [] : details.breakdown.map((b, i) => {
            const emiDate = new Date(new Date(openingDate).getFullYear(), new Date(openingDate).getMonth() + i, 11);
            return {
              id: generateId(),
              loanId: '',
              memberId,
              emiNumber: i + 1,
              amount: b.amount,
              interestComponent: b.interest,
              principalComponent: b.principal,
              dueDate: emiDate.toISOString(),
              penalty: 0,
              status: 'pending' as const,
              approvedByMember: false,
            };
          }),
        };
        loan.emiHistory = loan.emiHistory.map(e => ({ ...e, loanId: loan.id }));
        set(s => ({ loans: [...s.loans, loan] }));
      },

      addEMIPayment: (loanId, emiNumber, paidDate, applyPenalty) => {
        set(s => {
          const loan = s.loans.find(l => l.id === loanId);
          if (!loan) return s;
          const emi = loan.emiHistory.find(e => e.emiNumber === emiNumber);
          if (!emi || emi.status === 'paid') return s;
          
          let penalty = 0;
          if (applyPenalty) {
            const daysLate = calculatePenaltyDays(emi.dueDate);
            if (daysLate > 0) {
              penalty = daysLate * s.settings.lateFeePerDay;
            }
          }

          const penaltyRecord: PenaltyRecord = penalty > 0 ? {
            id: generateId(),
            memberId: loan.memberId,
            type: 'emi',
            referenceId: emi.id,
            amount: penalty,
            date: paidDate,
            daysLate: Math.ceil(penalty / s.settings.lateFeePerDay),
          } : null as any;

          return {
            loans: s.loans.map(l => {
              if (l.id !== loanId) return l;
              return {
                ...l,
                remainingAmount: Math.max(0, l.remainingAmount - emi.amount),
                emiHistory: l.emiHistory.map(e =>
                  e.emiNumber === emiNumber
                    ? { ...e, status: 'paid' as const, paidDate, penalty, approvedByMember: true }
                    : e
                ),
                status: l.emiHistory.every(e => e.emiNumber === emiNumber ? true : e.status === 'paid') && l.emiHistory.filter(e => e.emiNumber === emiNumber || e.status === 'paid').length === l.months
                  ? 'completed' as const
                  : l.status,
              };
            }),
            penalties: penaltyRecord ? [...s.penalties, penaltyRecord] : s.penalties,
          };
        });
      },

      addContribution: (memberId, month, paidDate, applyPenalty) => {
        const member = get().members.find(m => m.id === memberId);
        if (!member) return;
        const dueDate = getContributionDueDate(month);
        const existing = get().contributions.find(c => c.memberId === memberId && c.month === month);
        if (existing) return;

        let penalty = 0;
        if (applyPenalty) {
          const daysLate = calculatePenaltyDays(dueDate);
          if (daysLate > 0) penalty = daysLate * get().settings.lateFeePerDay;
        }

        const contributionId = generateId();

        const penaltyRecord: PenaltyRecord = penalty > 0 ? {
          id: generateId(),
          memberId,
          type: 'contribution',
          referenceId: contributionId,
          amount: penalty,
          date: paidDate,
          daysLate: Math.ceil(penalty / get().settings.lateFeePerDay),
        } : null as any;

        const contribution: Contribution = {
          id: contributionId,
          memberId,
          memberName: member.name,
          amount: get().settings.monthlyContribution,
          month,
          dueDate,
          paidDate,
          penalty,
          status: 'paid',
          approvedByMember: true,
          type: 'contribution',
        };

        set(s => ({
          contributions: [...s.contributions, contribution],
          penalties: penaltyRecord ? [...s.penalties, penaltyRecord] : s.penalties,
        }));
      },

      addBulkContribution: (month, memberIds, paidDate, applyPenalty) => {
        memberIds.forEach(memberId => {
          get().addContribution(memberId, month, paidDate, applyPenalty);
        });
      },

      editContribution: (contributionId, data) => {
        set(s => ({
          contributions: s.contributions.map(c => c.id === contributionId ? { ...c, ...data } : c),
        }));
      },

      editLoan: (loanId, data) => {
        set(s => ({
          loans: s.loans.map(l => l.id === loanId ? { ...l, ...data } : l),
        }));
      },

      editEMI: (loanId, emiId, data) => {
        set(s => ({
          loans: s.loans.map(l => {
            if (l.id !== loanId) return l;
            return {
              ...l,
              emiHistory: l.emiHistory.map(e => e.id === emiId ? { ...e, ...data } : e),
            };
          }),
        }));
      },

      updateSettings: (data) => {
        set(s => ({ settings: { ...s.settings, ...data } }));
      },

      setLanguage: (lang) => set({ language: lang }),

      addNotification: (message, type, targetMemberId) => {
        const notification: Notification = {
          id: generateId(),
          message,
          date: new Date().toISOString(),
          type,
          targetMemberId,
        };
        set(s => ({ notifications: [...s.notifications, notification] }));
      },

      exportMemberCSV: (memberId) => {
        const member = get().getMember(memberId);
        const loans = get().getMemberLoans(memberId);
        const contributions = get().getMemberContributions(memberId);
        if (!member) return '';
        let csv = `SHG BANK - Member Statement\n`;
        csv += `Name,${member.name}\n`;
        csv += `Mobile,${member.mobile}\n`;
        csv += `Joining Date,${member.joiningDate}\n`;
        csv += `Status,${member.inactiveSince ? 'Inactive since ' + member.inactiveSince : 'Active'}\n\n`;
        csv += `Contributions\nMonth,Type,Amount,Status,Penalty,Paid Date,Description\n`;
        contributions.forEach(c => {
          csv += `${c.month},${c.type || 'contribution'},${c.amount},${c.status},${c.penalty},${c.paidDate || ''},${c.description || ''}\n`;
        });
        csv += `\nLoans\nLoan ID,Amount,Months,Interest,Total,Status,Opening Date,Closing Date,Foreclosure Date\n`;
        loans.forEach(l => {
          csv += `${l.id},${l.amount},${l.months},${l.totalInterest},${l.totalPayable},${l.status},${l.openingDate},${l.closingDate || 'Running'},${l.foreclosureDate || ''}\n`;
        });
        csv += `\nMonthly ROI Breakdown\nMonth,Opening Balance,Contribution,Interest Earned,ROI %,Closing Balance\n`;
        const sortedContribs = [...contributions].sort((a, b) => a.month.localeCompare(b.month));
        let balance = 0;
        const monthlyData: Record<string, { contrib: number; interest: number }> = {};
        sortedContribs.forEach(c => {
          if (!monthlyData[c.month]) monthlyData[c.month] = { contrib: 0, interest: 0 };
          if (c.type === 'interest') monthlyData[c.month].interest += c.amount;
          else monthlyData[c.month].contrib += c.amount;
        });
        Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).forEach(([month, data]) => {
          const opening = balance;
          const roi = opening > 0 ? Math.round((data.interest / opening) * 10000) / 100 : 0;
          balance = opening + data.contrib + data.interest;
          csv += `${month},${opening},${data.contrib},${data.interest},${roi}%,${balance}\n`;
        });
        csv += `\nSummary\nTotal Contribution,${get().getMemberTotalContribution(memberId)}\n`;
        csv += `Interest Earnings,${get().getMemberInterestShare(memberId)}\n`;
        csv += `Penalty Earnings,${get().getMemberPenaltyShare(memberId)}\n`;
        csv += `Grand Total,${get().getMemberGrandTotal(memberId)}\n`;
        return csv;
      },

      exportMonthlyCSV: (month) => {
        const contributions = get().contributions.filter(c => c.month === month);
        let csv = `SHG BANK - Monthly Report - ${month}\n`;
        csv += `Name,Mobile,Amount,Status,Penalty,Paid Date\n`;
        contributions.forEach(c => {
          csv += `${c.memberName},${c.memberId},${c.amount},${c.status},${c.penalty},${c.paidDate || ''}\n`;
        });
        return csv;
      },

      // Computed getters
      getMember: (id) => get().members.find(m => m.id === id),
      getMemberByMobile: (mobile) => get().members.find(m => m.mobile === mobile),
      getMemberLoans: (memberId) => get().loans.filter(l => l.memberId === memberId),
      getMemberContributions: (memberId) => get().contributions.filter(c => c.memberId === memberId),
      
      getMemberTotalContribution: (memberId) => {
        return get().contributions
          .filter(c => c.memberId === memberId && c.status === 'paid')
          .reduce((sum, c) => sum + c.amount, 0);
      },

      getMemberPenaltyShare: (memberId) => {
        const member = get().getMember(memberId);
        if (!member || member.isAdmin) return 0;
        const memberContrib = get().getMemberTotalContribution(memberId);
        const allMembers = get().members.filter(m => m.isActive && !m.isAdmin);
        const totalContribs = allMembers.reduce((sum, m) => sum + get().getMemberTotalContribution(m.id), 0);
        if (totalContribs === 0) return 0;
        
        // Only penalties after member's joining date
        const joiningDate = new Date(member.joiningDate);
        const relevantPenalties = get().penalties.filter(p => new Date(p.date) >= joiningDate);
        const totalPenalty = relevantPenalties.reduce((sum, p) => sum + p.amount, 0);
        return Math.round((memberContrib / totalContribs) * totalPenalty * 100) / 100;
      },

      getMemberInterestShare: (memberId) => {
        const member = get().getMember(memberId);
        if (!member || member.isAdmin) return 0;
        const memberContrib = get().getMemberTotalContribution(memberId);
        const allMembers = get().members.filter(m => m.isActive && !m.isAdmin);
        const totalContribs = allMembers.reduce((sum, m) => sum + get().getMemberTotalContribution(m.id), 0);
        if (totalContribs === 0) return 0;
        
        // Only interest from loans given after member's joining date
        const joiningDate = new Date(member.joiningDate);
        const relevantLoans = get().loans.filter(l => l.status !== 'recalled' && l.status !== 'rejected' && l.status !== 'pending' && new Date(l.openingDate) >= joiningDate);
        const totalInterest = relevantLoans.reduce((sum, l) => sum + l.totalInterest, 0);
        return Math.round((memberContrib / totalContribs) * totalInterest * 100) / 100;
      },

      getMemberTotalEarnings: (memberId) => {
        return get().getMemberPenaltyShare(memberId) + get().getMemberInterestShare(memberId);
      },

      getMemberGrandTotal: (memberId) => {
        return get().getMemberTotalContribution(memberId) + get().getMemberTotalEarnings(memberId);
      },

      getActiveLoans: () => get().loans.filter(l => l.status === 'active'),
      getPendingLoans: () => get().loans.filter(l => l.status === 'pending'),
      getTotalCollection: () => {
        return get().contributions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
      },
      getTotalLoansGiven: () => {
        return get().loans
          .filter(l => l.status === 'active' || l.status === 'completed')
          .reduce((sum, l) => sum + l.amount, 0);
      },
      getRemainingBalance: () => {
        const collection = get().getTotalCollection();
        const loansGiven = get().getTotalLoansGiven();
        return collection - loansGiven;
      },
      getTotalPenaltyCollected: () => {
        return get().penalties.reduce((sum, p) => sum + p.amount, 0);
      },
      getTotalInterestCollected: () => {
        return get().loans
          .filter(l => l.status === 'active' || l.status === 'completed')
          .reduce((sum, l) => sum + l.totalInterest, 0);
      },
      getDefaulterNames: () => {
        const now = new Date();
        const currentMonth = getMonthKey(now);
        const contributions = get().contributions;
        return get().members
          .filter(m => m.isActive && !m.isAdmin)
          .filter(m => {
            // Check if any past contribution is unpaid
            const memberContribs = contributions.filter(c => c.memberId === m.id);
            return memberContribs.some(c => c.month < currentMonth && c.status !== 'paid');
          })
          .map(m => m.name);
      },
      canApplyLoan: (memberId) => {
        const activeLoans = get().loans.filter(l => l.memberId === memberId && (l.status === 'active' || l.status === 'pending'));
        if (activeLoans.length === 0) return true;
        return activeLoans.every(l => {
          const paidEmis = l.emiHistory.filter(e => e.status === 'paid').length;
          return paidEmis >= Math.ceil(l.months / 2);
        });
      },

      deleteContribution: (id) => {
        set(s => ({
          contributions: s.contributions.filter(c => c.id !== id),
          penalties: s.penalties.filter(p => p.referenceId !== id),
        }));
      },

      deleteLoan: (id) => {
        const loan = get().loans.find(l => l.id === id);
        if (!loan) return;
        const emiIds = loan.emiHistory.map(e => e.id);
        set(s => ({
          loans: s.loans.filter(l => l.id !== id),
          penalties: s.penalties.filter(p => !emiIds.includes(p.referenceId)),
        }));
      },

      addOldInterest: ({ memberId, amount, date, description }) => {
        const member = get().members.find(m => m.id === memberId);
        if (!member) return;
        const contribution: Contribution = {
          id: generateId(),
          memberId,
          memberName: member.name,
          amount,
          month: date.substring(0, 7),
          dueDate: date,
          paidDate: date,
          penalty: 0,
          status: 'paid',
          approvedByMember: true,
          type: 'interest',
          description,
        };
        set(s => ({ contributions: [...s.contributions, contribution] }));
      },

      forecloseLoan: (loanId) => {
        const today = new Date().toISOString().split('T')[0];
        set(s => ({
          loans: s.loans.map(l => l.id === loanId ? {
            ...l,
            status: 'foreclosed' as const,
            foreclosureDate: today,
            closingDate: today,
          } : l),
        }));
      },

      getForeclosureSummary: (loanId) => {
        const loan = get().loans.find(l => l.id === loanId);
        if (!loan) return null;
        const today = new Date();
        const opening = new Date(loan.openingDate);
        const daysActive = Math.max(1, Math.ceil((today.getTime() - opening.getTime()) / (1000 * 60 * 60 * 24)));
        const paidEmis = loan.emiHistory.filter(e => e.status === 'paid').length;
        const unpaidEmis = loan.emiHistory.filter(e => e.status !== 'paid');
        const pendingInterest = unpaidEmis.reduce((sum, e) => sum + e.interestComponent, 0);
        const pendingPrincipal = unpaidEmis.reduce((sum, e) => sum + (e.amount - e.interestComponent), 0);
        const totalSettlement = pendingPrincipal + pendingInterest;
        return {
          loanAmount: loan.amount,
          interestRate: get().settings.interestRate,
          daysActive,
          paidEmis,
          totalEmis: loan.months,
          pendingInterest,
          pendingPrincipal,
          totalSettlement,
        };
      },

      setMemberInactiveStatus: (memberId, inactiveSince) => {
        set(s => ({
          members: s.members.map(m => m.id === memberId ? { ...m, inactiveSince } : m),
        }));
      },

      getMemberLoanLimit: (memberId) => {
        const member = get().getMember(memberId);
        if (!member) return 0;
        if (member.inactiveSince) {
          return get().getMemberTotalContribution(memberId);
        }
        return get().settings.maxLoanAmount;
      },

      getAdminShare: () => {
        const admin = get().members.find(m => m.isAdmin);
        if (!admin) return { totalContribution: 0, interestEarnings: 0, penaltyEarnings: 0, sharePercent: 0 };
        const adminContrib = get().getMemberTotalContribution(admin.id);
        const allActiveMembers = get().members.filter(m => m.isActive);
        const totalContribs = allActiveMembers.reduce((sum, m) => sum + get().getMemberTotalContribution(m.id), 0);
        if (totalContribs === 0) return { totalContribution: adminContrib, interestEarnings: 0, penaltyEarnings: 0, sharePercent: 0 };
        const sharePercent = (adminContrib / totalContribs) * 100;
        const totalInterest = get().getTotalInterestCollected();
        const totalPenalty = get().getTotalPenaltyCollected();
        return {
          totalContribution: adminContrib,
          interestEarnings: Math.round((adminContrib / totalContribs) * totalInterest * 100) / 100,
          penaltyEarnings: Math.round((adminContrib / totalContribs) * totalPenalty * 100) / 100,
          sharePercent: Math.round(sharePercent * 100) / 100,
        };
      },

      exportAdminCSV: () => {
        const members = get().members.filter(m => m.isActive && !m.isAdmin);
        let csv = `SHG BANK - Complete Report\n\n`;
        csv += `Member Name,Status,Total Contribution,Interest Earnings,Penalty Earnings,ROI%,Current Loan,Month,Monthly Contribution,Monthly Interest\n`;
        members.forEach(member => {
          const tc = get().getMemberTotalContribution(member.id);
          const ie = get().getMemberInterestShare(member.id);
          const pe = get().getMemberPenaltyShare(member.id);
          const roi = tc > 0 ? Math.round(((ie + pe) / tc) * 10000) / 100 : 0;
          const activeLoans = get().loans.filter(l => l.memberId === member.id && l.status === 'active');
          const currentLoan = activeLoans.reduce((sum, l) => sum + l.remainingAmount, 0);
          const status = member.inactiveSince ? `Inactive since ${member.inactiveSince}` : 'Active';
          const contribs = get().getMemberContributions(member.id).sort((a, b) => a.month.localeCompare(b.month));
          if (contribs.length === 0) {
            csv += `${member.name},${status},${tc},${ie},${pe},${roi}%,${currentLoan},,,,\n`;
          } else {
            const monthlyData: Record<string, { contrib: number; interest: number }> = {};
            contribs.forEach(c => {
              if (!monthlyData[c.month]) monthlyData[c.month] = { contrib: 0, interest: 0 };
              if (c.type === 'interest') monthlyData[c.month].interest += c.amount;
              else monthlyData[c.month].contrib += c.amount;
            });
            let firstRow = true;
            Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).forEach(([month, data]) => {
              if (firstRow) {
                csv += `${member.name},${status},${tc},${ie},${pe},${roi}%,${currentLoan},${month},${data.contrib},${data.interest}\n`;
                firstRow = false;
              } else {
                csv += `,,,,,,,${month},${data.contrib},${data.interest}\n`;
              }
            });
          }
        });
        const totalFund = get().getTotalCollection();
        const totalLoans = get().getTotalLoansGiven();
        const totalInterest = get().getTotalInterestCollected();
        const totalPenalty = get().getTotalPenaltyCollected();
        const overallROI = totalFund > 0 ? Math.round(((totalInterest + totalPenalty) / totalFund) * 10000) / 100 : 0;
        const activeCount = members.filter(m => !m.inactiveSince).length;
        const inactiveCount = members.filter(m => m.inactiveSince).length;
        csv += `\nSUMMARY\n`;
        csv += `Total Members,${members.length}\n`;
        csv += `Active Members,${activeCount}\n`;
        csv += `Inactive Members,${inactiveCount}\n`;
        csv += `Total SHG Fund,${totalFund}\n`;
        csv += `Total Loans Active,${totalLoans}\n`;
        csv += `Total Interest Earned,${totalInterest}\n`;
        csv += `Total Penalty Collected,${totalPenalty}\n`;
        csv += `Overall SHG ROI,${overallROI}%\n`;
        return csv;
      },
    }),
    {
      name: 'shg-bank-storage',
    }
  )
);
