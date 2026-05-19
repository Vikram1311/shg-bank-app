import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import PaymentWidget from '../components/PaymentWidget';
import LoanApplyModal from '../components/LoanApplyModal';
import MemberSavingsTab from '../components/MemberSavingsTab';
import NotificationsCard from '../components/NotificationsCard';
import { Wallet, TrendingUp, Sparkles, Trophy, PiggyBank, Coins, AlertTriangle, Plus, KeyRound, Lock, X, Calendar, History, CheckCircle2, Hourglass, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function MemberDashboard() {
  const { user, t, fc, fd, refreshUser } = useApp();
  const [stats, setStats] = useState(null);
  const [loans, setLoans] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const loadData = async () => {
    try {
      const [s, l, c, d] = await Promise.all([
        api.get(`/members/${user.id}/stats`),
        api.get('/loans', { params: { memberId: user.id } }),
        api.get('/contributions', { params: { memberId: user.id } }),
        api.get('/defaulters'),
      ]);
      setStats(s.data);
      setLoans(l.data);
      setContributions(c.data.sort((a, b) => b.month.localeCompare(a.month)));
      setDefaulters(d.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadData(); }, []);

  const recallLoan = async (loanId) => {
    try {
      await api.post(`/loans/${loanId}/recall`);
      toast.success(t('recalled'));
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    }
  };

  const tabs = [
    { id: 'overview', label: t('overview'), icon: TrendingUp },
    { id: 'loans', label: t('loans'), icon: Coins },
    { id: 'contributions', label: t('contributions'), icon: PiggyBank },
    { id: 'savings', label: t('savings'), icon: PiggyBank },
    { id: 'profile', label: t('profile'), icon: KeyRound },
  ];

  return (
    <div className="min-h-screen pb-12">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6" data-testid="member-dashboard">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}-btn`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-[0_4px_0_0_#be123c]'
                  : 'bg-white/80 text-foreground hover:bg-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6 animate-slide-up">
            {/* Hero Card */}
            <div className="card-3d p-6 sm:p-8 bg-gradient-to-br from-primary via-rose-500 to-amber-500 text-white relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10" />
              <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-white/10" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center float-anim">
                  <Trophy className="w-10 h-10" />
                </div>
                <div>
                  <p className="text-sm font-bold opacity-90">{t('grandTotal')}</p>
                  <p className="text-4xl sm:text-5xl font-heading font-black mt-1" data-testid="member-grand-total">{fc(stats.grandTotal)}</p>
                  <p className="text-sm font-semibold mt-1 opacity-90">{user.name}</p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Wallet} label={t('myContribution')} value={fc(stats.totalContribution)} accent="primary" testId="stat-contribution" />
              <StatCard icon={AlertTriangle} label={t('penaltyShare')} value={fc(stats.penaltyShare)} accent="secondary" testId="stat-penalty-share" />
              <StatCard icon={Sparkles} label={t('interestShare')} value={fc(stats.interestShare)} accent="accent" testId="stat-interest-share" />
              <StatCard icon={PiggyBank} label={t('savingsBalance')} value={fc(stats.savingsBalance)} accent="success" testId="stat-savings" />
            </div>

            {/* Pending Penalty warning */}
            {stats.pendingPenalty > 0 && (
              <div className="card-3d p-5 bg-gradient-to-r from-red-50 to-amber-50 border-2 border-red-300 animate-pulse" data-testid="pending-penalty-card">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-10 h-10 text-red-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-heading font-black text-xl text-red-700">⚠️ चल रहा जुर्माना</h3>
                    <p className="text-sm font-bold text-red-800 mt-1">
                      आज तक <span className="text-2xl font-heading font-black">{fc(stats.pendingPenalty)}</span> जुर्माना जमा हुआ है (रोज़ बढ़ रहा है)
                    </p>
                    {stats.pendingPenaltyItems?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {stats.pendingPenaltyItems.map((it, idx) => (
                          <span key={idx} className="pill bg-red-100 text-red-700 text-[10px]" data-testid={`penalty-item-${idx}`}>
                            {it.type === 'contribution' ? `${it.month} योगदान` : `EMI #${it.emiNumber}`} • {it.daysLate} दिन • {fc(it.amount)}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-red-600 mt-2 font-semibold">तुरंत भुगतान करें - QR Code नीचे है</p>
                  </div>
                </div>
              </div>
            )}

            {/* Two-column section */}
            <div className="grid lg:grid-cols-3 gap-6">
              <PaymentWidget stats={stats} />

              {/* Quick actions */}
              <div className="card-3d p-6 lg:col-span-2">
                <h3 className="font-heading font-black text-xl mb-4 flex items-center gap-2">
                  <span className="w-2 h-7 bg-primary rounded-full" /> Quick Actions
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowLoanModal(true)}
                    className="btn-3d-primary flex items-center justify-center gap-2"
                    data-testid="apply-loan-btn"
                  >
                    <Plus className="w-5 h-5" /> {t('applyLoan')}
                  </button>
                  <button
                    onClick={() => setShowPwdModal(true)}
                    className="btn-3d-accent flex items-center justify-center gap-2"
                    data-testid="change-pwd-btn"
                  >
                    <Lock className="w-5 h-5" /> {t('changePassword')}
                  </button>
                </div>
                <div className="mt-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-amber-700 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold text-amber-900">{t('nextDue')}</p>
                    <p className="text-xs text-amber-800 font-semibold">11 {stats.currentMonth}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications + Defaulters in 2-col */}
            <div className="grid lg:grid-cols-2 gap-6">
              <NotificationsCard />

              {/* Defaulters list */}
              <div className="card-3d p-6">
                <h3 className="font-heading font-black text-xl mb-4 flex items-center gap-2 text-red-600">
                  <ShieldAlert className="w-6 h-6" /> {t('defaulters')}
                </h3>
                {defaulters.length === 0 ? (
                  <p className="text-muted-foreground text-sm" data-testid="no-defaulters">{t('noData')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2" data-testid="defaulters-list">
                    {defaulters.map((d, i) => (
                      <span key={d.id} className="pill bg-red-100 text-red-800" data-testid={`defaulter-${i}`}>
                        ⚠️ {d.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loans tab */}
        {activeTab === 'loans' && (
          <div className="space-y-4 animate-slide-up" data-testid="loans-tab">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-black text-2xl">{t('yourLoans')}</h2>
              <button onClick={() => setShowLoanModal(true)} className="btn-3d-primary flex items-center gap-2" data-testid="loans-apply-btn">
                <Plus className="w-4 h-4" /> {t('applyLoan')}
              </button>
            </div>
            {loans.length === 0 ? (
              <div className="card-3d p-10 text-center">
                <Coins className="w-16 h-16 mx-auto text-muted-foreground" />
                <p className="mt-3 font-semibold text-muted-foreground">{t('noData')}</p>
              </div>
            ) : (
              loans.map((l) => (
                <LoanCard key={l.id} loan={l} onRecall={() => recallLoan(l.id)} />
              ))
            )}
          </div>
        )}

        {/* Contributions tab */}
        {activeTab === 'contributions' && (
          <div className="space-y-4 animate-slide-up" data-testid="contributions-tab">
            <h2 className="font-heading font-black text-2xl">{t('contribHistory')}</h2>
            <div className="card-3d overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-primary/10 to-accent/10">
                    <tr>
                      <th className="text-left p-3 font-bold">{t('month')}</th>
                      <th className="text-left p-3 font-bold">{t('amount')}</th>
                      <th className="text-left p-3 font-bold">{t('paidDate')}</th>
                      <th className="text-left p-3 font-bold">Penalty</th>
                      <th className="text-left p-3 font-bold">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributions.length === 0 ? (
                      <tr><td colSpan="5" className="p-6 text-center text-muted-foreground">{t('noData')}</td></tr>
                    ) : contributions.map((c) => (
                      <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30">
                        <td className="p-3 font-bold">{c.month}</td>
                        <td className="p-3 text-primary font-bold">{fc(c.amount)}</td>
                        <td className="p-3 text-muted-foreground">{fd(c.paidDate)}</td>
                        <td className="p-3 text-amber-700 font-semibold">{c.penalty > 0 ? fc(c.penalty) : '-'}</td>
                        <td className="p-3">
                          <span className={`pill ${c.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {c.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Hourglass className="w-3 h-3" />}
                            {t(c.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <ProfileTab onUpdate={refreshUser} onChangePwd={() => setShowPwdModal(true)} />
        )}

        {/* Savings tab */}
        {activeTab === 'savings' && <MemberSavingsTab />}
      </main>

      <LoanApplyModal
        open={showLoanModal}
        onClose={() => setShowLoanModal(false)}
        memberId={user.id}
        canApply={stats?.canApplyLoan}
        blockReason={stats?.blockReason}
        onSuccess={loadData}
      />
      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}
    </div>
  );
}

function LoanCard({ loan, onRecall }) {
  const { t, fc, fd } = useApp();
  const paidCount = loan.emiHistory.filter((e) => e.status === 'paid').length;
  const statusColors = {
    pending: 'bg-amber-100 text-amber-800',
    active: 'bg-emerald-100 text-emerald-800',
    completed: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
    recalled: 'bg-slate-200 text-slate-700',
  };
  return (
    <div className="card-3d p-5" data-testid={`loan-card-${loan.id}`}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`pill ${statusColors[loan.status]}`}>{t(loan.status)}</span>
            {loan.isOldLoan && <span className="pill bg-violet-100 text-violet-700">Old</span>}
          </div>
          <p className="font-heading font-black text-2xl mt-2">{fc(loan.amount)}</p>
          <p className="text-xs text-muted-foreground font-semibold mt-1">
            {loan.months} {t('months')} • EMI {fc(loan.emiAmount)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-bold">{t('totalInterest')}</p>
          <p className="font-bold text-amber-600">{fc(loan.totalInterest)}</p>
          <p className="text-xs text-muted-foreground mt-2">{paidCount}/{loan.months} EMI paid</p>
        </div>
      </div>

      {loan.status === 'pending' && (
        <button onClick={onRecall} className="btn-3d-danger mt-4 w-full sm:w-auto text-sm py-2" data-testid={`recall-loan-${loan.id}`}>
          {t('recall')}
        </button>
      )}

      {loan.emiHistory.length > 0 && (
        <details className="mt-4">
          <summary className="font-bold text-sm cursor-pointer text-primary">{t('emiHistory')} ↓</summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left p-1">#</th>
                  <th className="text-left p-1">{t('amount')}</th>
                  <th className="text-left p-1">{t('dueDate')}</th>
                  <th className="text-left p-1">{t('paidDate')}</th>
                  <th className="text-left p-1">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {loan.emiHistory.map((e) => (
                  <tr key={e.id} className="border-t border-border/40">
                    <td className="p-1 font-bold">{e.emiNumber}</td>
                    <td className="p-1">{fc(e.amount)}</td>
                    <td className="p-1">{fd(e.dueDate)}</td>
                    <td className="p-1">{e.paidDate ? fd(e.paidDate) : '-'}</td>
                    <td className="p-1">
                      <span className={`pill text-[10px] py-0.5 ${e.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {t(e.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function ProfileTab({ onUpdate, onChangePwd }) {
  const { user, t, refreshUser } = useApp();
  const [name, setName] = useState(user.name);
  const [mobile, setMobile] = useState(user.mobile);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await api.put(`/members/${user.id}`, { name, mobile });
      toast.success(t('success'));
      await refreshUser();
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-3d p-6 max-w-2xl animate-slide-up" data-testid="profile-tab">
      <h2 className="font-heading font-black text-2xl mb-4">{t('profile')}</h2>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold mb-2 block">{t('name')}</label>
          <input className="input-3d" value={name} onChange={(e) => setName(e.target.value)} data-testid="profile-name-input" />
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">{t('mobile')}</label>
          <input className="input-3d" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={10} data-testid="profile-mobile-input" />
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={loading} className="btn-3d-primary" data-testid="profile-save-btn">{t('save')}</button>
          <button onClick={onChangePwd} className="btn-3d-accent" data-testid="profile-change-pwd-btn">{t('changePassword')}</button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const { user, t } = useApp();
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!pwd) return;
    setLoading(true);
    try {
      await api.post('/auth/change-password', { memberId: user.id, newPassword: pwd });
      toast.success(t('success'));
      onClose();
    } catch (e) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-3d max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="change-pwd-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl">{t('changePassword')}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <input
          type="password"
          className="input-3d"
          placeholder={t('newPassword')}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          data-testid="new-pwd-input"
        />
        <button onClick={save} disabled={loading} className="btn-3d-primary w-full mt-4" data-testid="save-pwd-btn">
          {loading ? t('loading') : t('save')}
        </button>
      </div>
    </div>
  );
}
