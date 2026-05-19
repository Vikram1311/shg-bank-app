import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import AdminSavingsTab from '../components/AdminSavingsTab';
import OldLoanModal from '../components/OldLoanModal';
import { Wallet, TrendingUp, Coins, Users, AlertTriangle, Download, Plus, CheckCircle2, X, Edit, Trash2, KeyRound, Settings as SettingsIcon, History, PiggyBank, Sparkles, ShieldAlert, FileClock } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { t, fc, fd, settings, setSettings } = useApp();
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  const loadAll = async () => {
    try {
      const [s, m, l, c, d] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/members'),
        api.get('/loans'),
        api.get('/contributions'),
        api.get('/defaulters'),
      ]);
      setStats(s.data);
      setMembers(m.data);
      setLoans(l.data);
      setContributions(c.data);
      setDefaulters(d.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const downloadCSV = async () => {
    try {
      const r = await api.get('/csv/all');
      const blob = new Blob([r.data.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shg-bank-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('success'));
    } catch (e) {
      toast.error(t('error'));
    }
  };

  const tabs = [
    { id: 'overview', label: t('overview'), icon: TrendingUp },
    { id: 'loans', label: t('loans'), icon: Coins },
    { id: 'contributions', label: t('contributions'), icon: PiggyBank },
    { id: 'members', label: t('members'), icon: Users },
    { id: 'settings', label: t('settings'), icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen pb-12">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6" data-testid="admin-dashboard">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-testid={`admin-tab-${tab.id}-btn`}
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

        {activeTab === 'overview' && stats && (
          <div className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Wallet} label={t('totalCollection')} value={fc(stats.totalCollection)} accent="primary" testId="admin-stat-collection" />
              <StatCard icon={Coins} label={t('totalLoansGiven')} value={fc(stats.totalLoansGiven)} accent="secondary" testId="admin-stat-loans" />
              <StatCard icon={TrendingUp} label={t('remainingBalance')} value={fc(stats.remainingBalance)} accent="accent" testId="admin-stat-balance" />
              <StatCard icon={PiggyBank} label={t('totalSavings')} value={fc(stats.totalSavings)} accent="success" testId="admin-stat-savings" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={AlertTriangle} label={t('totalPenalty')} value={fc(stats.totalPenalty)} accent="danger" testId="admin-stat-penalty" />
              <StatCard icon={Sparkles} label={t('totalInterest')} value={fc(stats.totalInterest)} accent="accent" testId="admin-stat-interest" />
              <StatCard icon={History} label={t('pendingLoans')} value={stats.pendingLoansCount} accent="secondary" testId="admin-stat-pending" />
              <StatCard icon={Users} label={t('members')} value={members.length} accent="primary" testId="admin-stat-members" />
            </div>

            {/* CSV Export */}
            <div className="card-3d p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-heading font-black text-xl">{t('csvExport')}</h3>
                <p className="text-sm text-muted-foreground">{t('appName')} - Full Data Report</p>
              </div>
              <button onClick={downloadCSV} className="btn-3d-success flex items-center gap-2" data-testid="csv-download-btn">
                <Download className="w-5 h-5" /> {t('download')}
              </button>
            </div>

            {/* Pending Loans */}
            {stats.pendingLoansCount > 0 && (
              <div className="card-3d p-6">
                <h3 className="font-heading font-black text-xl mb-4 flex items-center gap-2 text-amber-700">
                  <History className="w-6 h-6" /> {t('pendingLoans')}
                </h3>
                <div className="space-y-2">
                  {loans.filter((l) => l.status === 'pending').map((l) => (
                    <PendingLoanRow key={l.id} loan={l} onAction={loadAll} />
                  ))}
                </div>
              </div>
            )}

            {/* Defaulters */}
            <div className="card-3d p-6">
              <h3 className="font-heading font-black text-xl mb-4 flex items-center gap-2 text-red-600">
                <ShieldAlert className="w-6 h-6" /> {t('defaulters')}
              </h3>
              {defaulters.length === 0 ? (
                <p className="text-muted-foreground">{t('noData')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {defaulters.map((d) => (
                    <span key={d.id} className="pill bg-red-100 text-red-800">⚠️ {d.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'loans' && <LoansTab loans={loans} members={members} onChange={loadAll} />}
        {activeTab === 'contributions' && <ContributionsTab members={members} onChange={loadAll} />}
        {activeTab === 'savings' && <AdminSavingsTab members={members} />}
        {activeTab === 'members' && <MembersTab members={members} onChange={loadAll} />}
        {activeTab === 'settings' && <SettingsTab settings={settings} onUpdate={setSettings} />}
      </main>
    </div>
  );
}

function PendingLoanRow({ loan, onAction }) {
  const { t, fc } = useApp();
  const approve = async () => {
    try {
      await api.post(`/loans/${loan.id}/approve`);
      toast.success(t('approved'));
      onAction();
    } catch { toast.error(t('error')); }
  };
  const reject = async () => {
    try {
      await api.post(`/loans/${loan.id}/reject`);
      toast.success(t('rejected'));
      onAction();
    } catch { toast.error(t('error')); }
  };
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border-2 border-amber-200 flex-wrap gap-2" data-testid={`pending-loan-${loan.id}`}>
      <div>
        <p className="font-bold">{loan.memberName}</p>
        <p className="text-xs text-muted-foreground font-semibold">{fc(loan.amount)} • {loan.months} months • EMI {fc(loan.emiAmount)}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={approve} className="btn-3d-success py-2 px-4 text-sm" data-testid={`approve-loan-${loan.id}`}>✓ {t('approve')}</button>
        <button onClick={reject} className="btn-3d-danger py-2 px-4 text-sm" data-testid={`reject-loan-${loan.id}`}>✕ {t('reject')}</button>
      </div>
    </div>
  );
}

function LoansTab({ loans, members, onChange }) {
  const { t, fc, fd } = useApp();
  const [filter, setFilter] = useState('all');
  const [showOldLoan, setShowOldLoan] = useState(false);
  const filtered = filter === 'all' ? loans : loans.filter((l) => l.status === filter);

  const payEMI = async (loanId, emiNumber) => {
    try {
      await api.post('/loans/emi-pay', {
        loanId, emiNumber, paidDate: new Date().toISOString().slice(0, 10), applyPenalty: true,
      });
      toast.success(t('success'));
      onChange();
    } catch (e) { toast.error(e.response?.data?.detail || t('error')); }
  };

  const deleteLoan = async (loanId) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/loans/${loanId}`);
      toast.success(t('success'));
      onChange();
    } catch { toast.error(t('error')); }
  };

  return (
    <div className="space-y-4 animate-slide-up" data-testid="admin-loans-tab">
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'active', 'completed', 'rejected'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} data-testid={`loan-filter-${f}`}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-white/80'}`}>
              {f === 'all' ? 'All' : t(f)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowOldLoan(true)} className="btn-3d-accent flex items-center gap-2" data-testid="add-old-loan-btn">
          <FileClock className="w-4 h-4" /> {t('addOldLoan')}
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="card-3d p-10 text-center text-muted-foreground">{t('noData')}</div>
      ) : (
        filtered.map((l) => (
          <div key={l.id} className="card-3d p-5" data-testid={`admin-loan-${l.id}`}>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="font-heading font-black text-lg">{l.memberName}</p>
                <p className="text-sm text-muted-foreground">{fc(l.amount)} • {l.months} mo • EMI {fc(l.emiAmount)}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="pill bg-primary/10 text-primary">{t(l.status)}</span>
                  {l.isOldLoan && <span className="pill bg-violet-100 text-violet-700">Old</span>}
                  {l.guarantorName && <span className="pill bg-amber-100 text-amber-800">गारंटर: {l.guarantorName}</span>}
                </div>
              </div>
              <button onClick={() => deleteLoan(l.id)} className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100" data-testid={`delete-loan-${l.id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {l.status === 'active' && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><th className="text-left p-1">#</th><th className="text-left p-1">EMI</th><th className="text-left p-1">{t('dueDate')}</th><th className="text-left p-1">{t('status')}</th><th></th></tr></thead>
                  <tbody>
                    {l.emiHistory.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="p-1">{e.emiNumber}</td>
                        <td className="p-1">{fc(e.amount)}</td>
                        <td className="p-1">{fd(e.dueDate)}</td>
                        <td className="p-1"><span className={`pill text-[10px] ${e.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t(e.status)}</span></td>
                        <td className="p-1">
                          {e.status === 'pending' && (
                            <button onClick={() => payEMI(l.id, e.emiNumber)} className="btn-3d-success text-[10px] py-1 px-2" data-testid={`pay-emi-${l.id}-${e.emiNumber}`}>
                              {t('payEmi')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
      {showOldLoan && <OldLoanModal members={members} onClose={() => setShowOldLoan(false)} onSuccess={onChange} />}
    </div>
  );
}

function ContributionsTab({ members, onChange }) {
  const { t, fc, fd } = useApp();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedIds, setSelectedIds] = useState([]);
  const [contribs, setContribs] = useState([]);
  const [applyPenalty, setApplyPenalty] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingContrib, setEditingContrib] = useState(null);

  const loadContribs = async () => {
    const r = await api.get('/contributions');
    setContribs(r.data.sort((a, b) => b.month.localeCompare(a.month)));
  };
  useEffect(() => { loadContribs(); }, []);

  const deleteContrib = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/contributions/${id}`);
      toast.success(t('success'));
      await loadContribs();
      onChange();
    } catch { toast.error(t('error')); }
  };

  const nonAdmin = members.filter((m) => !m.isAdmin && m.isActive);
  const submit = async () => {
    setLoading(true);
    try {
      await api.post('/contributions/bulk', {
        month,
        memberIds: selectedIds.length ? selectedIds : nonAdmin.map((m) => m.id),
        paidDate: new Date().toISOString().slice(0, 10),
        applyPenalty,
      });
      toast.success(t('success'));
      setSelectedIds([]);
      await loadContribs();
      onChange();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setLoading(false); }
  };

  const toggleAll = () => {
    if (selectedIds.length === nonAdmin.length) setSelectedIds([]);
    else setSelectedIds(nonAdmin.map((m) => m.id));
  };

  return (
    <div className="space-y-4 animate-slide-up" data-testid="admin-contributions-tab">
      <div className="card-3d p-6">
        <h3 className="font-heading font-black text-xl mb-4">{t('bulkContribution')}</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold mb-2 block">{t('month')}</label>
            <input type="month" className="input-3d" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="bulk-month-input" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 font-bold text-sm">
              <input type="checkbox" checked={applyPenalty} onChange={(e) => setApplyPenalty(e.target.checked)} className="w-5 h-5 accent-primary" data-testid="bulk-penalty-toggle" />
              {t('applyPenalty')}
            </label>
          </div>
        </div>

        <div className="mt-4">
          <button onClick={toggleAll} className="text-sm font-bold text-primary mb-2" data-testid="bulk-toggle-all">
            {selectedIds.length === nonAdmin.length ? 'Deselect All' : 'Select All'}
          </button>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 bg-muted/30 rounded-2xl">
            {nonAdmin.map((m) => {
              const checked = selectedIds.includes(m.id);
              const exists = contribs.find((c) => c.memberId === m.id && c.month === month);
              return (
                <label key={m.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer ${checked ? 'bg-primary/10' : 'bg-white'} ${exists ? 'opacity-50' : ''}`}>
                  <input type="checkbox" checked={checked} disabled={!!exists}
                    onChange={() => setSelectedIds((p) => p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id])}
                    className="accent-primary"
                    data-testid={`bulk-member-${m.id}`}
                  />
                  <span className="text-sm font-bold">{m.name}</span>
                  {exists && <CheckCircle2 className="w-3 h-3 text-emerald-600 ml-auto" />}
                </label>
              );
            })}
          </div>
        </div>

        <button onClick={submit} disabled={loading} className="btn-3d-primary mt-4 flex items-center gap-2" data-testid="bulk-submit-btn">
          <Plus className="w-4 h-4" /> {loading ? t('loading') : t('addContribution')}
        </button>
      </div>

      <div className="card-3d p-4 sm:p-6">
        <h3 className="font-heading font-black text-xl mb-4">{t('contribHistory')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-primary/10 to-accent/10">
              <tr>
                <th className="text-left p-2 font-bold">{t('name')}</th>
                <th className="text-left p-2 font-bold">{t('month')}</th>
                <th className="text-left p-2 font-bold">{t('amount')}</th>
                <th className="text-left p-2 font-bold">Penalty</th>
                <th className="text-left p-2 font-bold">{t('paidDate')}</th>
                <th className="text-left p-2 font-bold">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {contribs.slice(0, 100).map((c) => (
                <tr key={c.id} className="border-t border-border/60" data-testid={`contrib-row-${c.id}`}>
                  <td className="p-2 font-bold">{c.memberName}</td>
                  <td className="p-2">{c.month}</td>
                  <td className="p-2 text-primary font-bold">{fc(c.amount)}</td>
                  <td className="p-2 text-amber-700">{c.penalty > 0 ? fc(c.penalty) : '-'}</td>
                  <td className="p-2 text-xs">{fd(c.paidDate)}</td>
                  <td className="p-2 flex gap-1">
                    <button onClick={() => setEditingContrib(c)} className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100" data-testid={`edit-contrib-${c.id}`}>
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteContrib(c.id)} className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100" data-testid={`delete-contrib-${c.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editingContrib && <EditContribModal contrib={editingContrib} onClose={() => setEditingContrib(null)} onSuccess={loadContribs} />}
    </div>
  );
}

function EditContribModal({ contrib, onClose, onSuccess }) {
  const { t } = useApp();
  const [amount, setAmount] = useState(contrib.amount);
  const [paidDate, setPaidDate] = useState(contrib.paidDate?.slice(0, 10) || '');
  const [penalty, setPenalty] = useState(contrib.penalty || 0);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await api.put(`/contributions/${contrib.id}`, { amount: Number(amount), paidDate, penalty: Number(penalty) });
      toast.success(t('success'));
      onSuccess();
      onClose();
    } catch { toast.error(t('error')); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-3d max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="edit-contrib-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl">Edit Contribution</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-bold">{t('amount')}</label>
            <input type="number" className="input-3d" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="edit-contrib-amount" />
          </div>
          <div><label className="text-xs font-bold">{t('paidDate')}</label>
            <input type="date" className="input-3d" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} data-testid="edit-contrib-date" />
          </div>
          <div><label className="text-xs font-bold">Penalty</label>
            <input type="number" className="input-3d" value={penalty} onChange={(e) => setPenalty(e.target.value)} data-testid="edit-contrib-penalty" />
          </div>
          <button onClick={save} disabled={loading} className="btn-3d-primary w-full" data-testid="edit-contrib-save-btn">{loading ? t('loading') : t('save')}</button>
        </div>
      </div>
    </div>
  );
}

function MembersTab({ members, onChange }) {
  const { t, fc } = useApp();
  const [showAdd, setShowAdd] = useState(false);

  const remove = async (id) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.delete(`/members/${id}`);
      toast.success(t('success'));
      onChange();
    } catch { toast.error(t('error')); }
  };

  const reset = async (id) => {
    try {
      const r = await api.post(`/auth/reset-password/${id}`);
      toast.success(`Password reset: ${r.data.newPassword}`);
    } catch { toast.error(t('error')); }
  };

  return (
    <div className="space-y-4 animate-slide-up" data-testid="admin-members-tab">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-black text-2xl">{t('members')}</h2>
        <button onClick={() => setShowAdd(true)} className="btn-3d-primary flex items-center gap-2" data-testid="add-member-btn">
          <Plus className="w-4 h-4" /> {t('addMember')}
        </button>
      </div>
      <div className="card-3d overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-primary/10 to-accent/10">
              <tr>
                <th className="text-left p-3 font-bold">{t('name')}</th>
                <th className="text-left p-3 font-bold">{t('mobile')}</th>
                <th className="text-left p-3 font-bold">{t('joiningDate')}</th>
                <th className="text-left p-3 font-bold">{t('status')}</th>
                <th className="text-left p-3 font-bold">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border/60 hover:bg-muted/20">
                  <td className="p-3 font-bold">{m.name} {m.isAdmin && <span className="pill bg-violet-100 text-violet-700 text-[10px]">{t('admin')}</span>}</td>
                  <td className="p-3 font-mono">{m.mobile}</td>
                  <td className="p-3 text-xs">{m.joiningDate}</td>
                  <td className="p-3"><span className={`pill ${m.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{m.isActive ? t('active') : t('inactive')}</span></td>
                  <td className="p-3 flex gap-1">
                    <button onClick={() => reset(m.id)} className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100" data-testid={`reset-pwd-${m.id}`} title={t('resetPwd')}>
                      <KeyRound className="w-4 h-4" />
                    </button>
                    {!m.isAdmin && (
                      <button onClick={() => remove(m.id)} className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100" data-testid={`remove-member-${m.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} onAdd={onChange} />}
    </div>
  );
}

function AddMemberModal({ onClose, onAdd }) {
  const { t } = useApp();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post('/members', { name, mobile, joiningDate });
      toast.success(t('success'));
      onAdd();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-3d max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="add-member-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl">{t('addMember')}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <input className="input-3d" placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} data-testid="new-member-name" />
          <input className="input-3d" placeholder={t('mobile')} value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={10} data-testid="new-member-mobile" />
          <input className="input-3d" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} data-testid="new-member-date" />
          <button onClick={submit} disabled={loading} className="btn-3d-primary w-full" data-testid="submit-add-member-btn">{loading ? t('loading') : t('save')}</button>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ settings, onUpdate }) {
  const { t } = useApp();
  const [form, setForm] = useState(settings || {});
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const save = async () => {
    setLoading(true);
    try {
      const r = await api.put('/settings', form);
      onUpdate(r.data);
      toast.success(t('success'));
    } catch { toast.error(t('error')); }
    finally { setLoading(false); }
  };

  if (!settings) return <div>{t('loading')}</div>;

  return (
    <div className="card-3d p-6 max-w-2xl animate-slide-up" data-testid="admin-settings-tab">
      <h2 className="font-heading font-black text-2xl mb-4">{t('settings')}</h2>
      <div className="space-y-4">
        <Field label={t('upiId')} value={form.upiId} onChange={(v) => setForm({ ...form, upiId: v })} testId="settings-upi" />
        <Field label={t('monthlyContribution')} type="number" value={form.monthlyContribution} onChange={(v) => setForm({ ...form, monthlyContribution: Number(v) })} testId="settings-monthly" />
        <Field label={t('maxLoan')} type="number" value={form.maxLoanAmount} onChange={(v) => setForm({ ...form, maxLoanAmount: Number(v) })} testId="settings-maxloan" />
        <Field label={t('interestRate') + ' (%)'} type="number" value={form.interestRate} onChange={(v) => setForm({ ...form, interestRate: Number(v) })} testId="settings-rate" />
        <Field label={t('lateFee')} type="number" value={form.lateFeePerDay} onChange={(v) => setForm({ ...form, lateFeePerDay: Number(v) })} testId="settings-fee" />
        <button onClick={save} disabled={loading} className="btn-3d-primary" data-testid="settings-save-btn">{loading ? t('loading') : t('saveSettings')}</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', testId }) {
  return (
    <div>
      <label className="text-sm font-bold mb-2 block">{label}</label>
      <input className="input-3d" type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
    </div>
  );
}
