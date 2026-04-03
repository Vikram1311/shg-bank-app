export function calculateEMI(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * monthlyRate * factor / (factor - 1);
}

export function calculateLoanDetails(principal: number, months: number, rate: number = 0.02) {
  const emi = calculateEMI(principal, rate, months);
  const totalPayable = emi * months;
  const totalInterest = totalPayable - principal;
  const breakdown = [];
  let remaining = principal;
  for (let i = 1; i <= months; i++) {
    const interest = remaining * rate;
    const principalComp = emi - interest;
    remaining -= principalComp;
    breakdown.push({
      emiNumber: i,
      amount: Math.round(emi * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principalComp * 100) / 100,
      remaining: Math.round(Math.max(0, remaining) * 100) / 100,
    });
  }
  return {
    emi: Math.round(emi * 100) / 100,
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    breakdown,
  };
}

export function calculatePenaltyDays(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), 11, 23, 59, 59);
  if (now <= dueDay) return 0;
  return Math.ceil((now.getTime() - dueDay.getTime()) / (1000 * 60 * 60 * 24));
}

export function calculatePenalty(dueDate: string, feePerDay: number = 10): number {
  return calculatePenaltyDays(dueDate) * feePerDay;
}

export function calculateShare(
  memberContribution: number,
  totalContributions: number,
  totalEarnings: number
): number {
  if (totalContributions === 0) return 0;
  return Math.round((memberContribution / totalContributions) * totalEarnings * 100) / 100;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatDate(dateStr: string, locale: string = 'hi-IN'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'ta' ? 'ta-IN' : locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number, locale: string = 'hi-IN'): string {
  return new Intl.NumberFormat(locale === 'ta' ? 'ta-IN' : locale, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getDefaultPassword(mobile: string): string {
  return mobile.slice(-4);
}

export function getDueDateForMonth(yearMonth: string, dueDay: number = 11): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, dueDay).toISOString();
}

export function isDefaulter(contributions: { month: string; status: string }[]): boolean {
  const now = new Date();
  const currentMonth = getMonthKey(now);
  return contributions.some(
    (c) => c.month < currentMonth && c.status !== 'paid'
  );
}

export function getContributionDueDate(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 11).toISOString();
}
