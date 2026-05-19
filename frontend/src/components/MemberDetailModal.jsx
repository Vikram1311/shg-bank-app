import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { X, User, Wallet, Coins, PiggyBank, AlertTriangle, Shield, Edit, Save, Trash2, KeyRound } from 'lucide-react';

export default function MemberDetailModal({ memberId, onClose, onChange }) {
  const { t, fc, fd } = useApp();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('summary');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const load = async () => {
    try {
      const [d, s] = await Promise.all([
        api.get(`/members/${memberId}/full-detail`),
        api.get(`/members/${memberId}/stats`),
      ]);
      setData(d.data);
      setStats(s.data);
      setEditForm({
        name: d.data.member.name,
        mobile: d.data.member.mobile,
        joiningDate: d.data.member.joiningDate?.slice(0, 10),
        isActive: d.data.member.isActive,
      });
    } catch (e) {
      toast.error(t('error'));
    }
  };

  useEffect(() => { load(); }, [memberId]);

  const saveMember = async () => {
    try {
      await api.put(`/members/${memberId}`, editForm);
      toast.success(t('success'));
      setEditing(false);
      load();
      onChange?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    }
  };

  const resetPwd = async () => {
    try {
      const r = await api.post(`/auth/reset-password/${memberId}`);
      toast.success(`Password reset to: ${r.data.newPassword}`);
    } catch { toast.error(t('error')); }
  };

  const removeMember = async () => {
    if (!window.confirm(`Remove ${data.member.name}?`)) return;
    try {
      await api.delete(`/members/${memberId}`);
      toast.success(t('success'));
      onChange?.();
      onClose();
    } catch { toast.error(t('error')); }
  };

  const deleteContrib = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try { await api.delete(`/contributions/${id}`); toast.success(t('success')); load(); onChange?.(); }
    catch { toast.error(t('error')); }
  };

  const deleteSavings = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try { await api.delete(`/savings/${id}`); toast.success(t('success')); load(); onChange?.(); }
    catch { toast.error(t('error')); }
  };

  const deleteLoan = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try { await api.delete(`/loans/${id}`); toast.success(t('success')); load(); onChange?.(); }
    catch { toast.error(t('error')); }
  };

  const approveLoan = async (id) => {
    try { await api.post(`/loans/${id}/approve`); toast.success(t('success')); load(); onChange?.(); }
    catch { toast.error(t('error')); }
  };

  if (!data || !stats) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="card-3d p-8">{t('loading')}</div>
      </div>
    );
  }

  const m = data.member;
  const tabs = [
    { id: 'summary', label: 'सारांश', icon: User },
    { id: 'loans', label: t('loans'), icon: Coins },
    { id: 'contributions', label: t('contributions'), icon: Wallet },
    { id: 'savings', label: t('savings'), icon: PiggyBank },
    { id: 'penalties', label: 'जुर्माना', icon: AlertTriangle },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-scale-in" onClick={onClose}>
      <div className="card-3d max-w-5xl w-full max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="member-detail-modal">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-primary via-rose-500 to-amber-500 text-white relative sticky top-0 z-10">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl bg-white/20 hover:bg-white/30" data-testid="member-detail-close">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center">
              <User className="w-10 h-10" />
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="space-y-2">
                  <input className="text-2xl font-heading font-black bg-white/20 px-3 py-1 rounded-xl w-full text-white placeholder-white/60"
                    value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} data-testid="edit-member-name" />
                  <input className="bg-white/20 px-3 py-1 rounded-xl text-white" maxLength="10"
                    value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} data-testid="edit-member-mobile" />
                  <input type="date" className="bg-white/20 px-3 py-1 rounded-xl text-white"
                    value={editForm.joiningDate} onChange={(e) => setEditForm({ ...editForm, joiningDate: e.target.value })} data-testid="edit-member-date" />
                </div>
              ) : (
                <>
                  <h2 className="font-heading font-black text-3xl">{m.name}</h2>
                  <p className="text-sm opacity-90 font-bold">📱 {m.mobile} • {fd(m.joiningDate)}</p>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {m.isAdmin && <span className="pill bg-white/30 text-white">{t('admin')}</span>}
                    <span className={`pill ${m.isActive ? 'bg-emerald-500/80' : 'bg-slate-500/80'}`}>
                      {m.isActive ? t('active') : t('inactive')}
                    </span>
                    {m.language === 'ta' && <span className="pill bg-violet-500/80">Tamil</span>}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Quick action bar */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {editing ? (
              <>
                <button onClick={saveMember} className="bg-white text-primary font-bold px-3 py-1.5 rounded-xl text-sm flex items-center gap-1" data-testid="member-save-btn">
                  <Save className="w-4 h-4" /> {t('save')}
                </button>
                <button onClick={() => setEditing(false)} className="bg-white/20 text-white font-bold px-3 py-1.5 rounded-xl text-sm">
                  {t('cancel')}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1.5 rounded-xl text-sm flex items-center gap-1" data-testid="member-edit-btn">
                  <Edit className="w-4 h-4" /> {t('edit')}
                </button>
                <button onClick={resetPwd} className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1.5 rounded-xl text-sm flex items-center gap-1" data-testid="member-reset-pwd">
                  <KeyRound className="w-4 h-4" /> {t('resetPwd')}
                </button>
                {!m.isAdmin && (
                  <button onClick={removeMember} className="bg-red-500/80 hover:bg-red-600 text-white font-bold px-3 py-1.5 rounded-xl text-sm flex items-center gap-1" data-testid="member-remove-btn">
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-2 overflow-x-auto pb-2 border-b">
          {tabs.map((tt) => (
            <button key={tt.id} onClick={() => setTab(tt.id)} data-testid={`detail-tab-${tt.id}`}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${tab === tt.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <tt.icon className="w-4 h-4" /> {tt.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {tab === 'summary' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SummaryCard label="कुल योगदान" value={fc(stats.totalContribution)} color="from-pink-500 to-rose-500" />
              <SummaryCard label="जुर्माना हिस्सा" value={fc(stats.penaltyShare)} color="from-amber-500 to-orange-500" />
              <SummaryCard label="ब्याज हिस्सा" value={fc(stats.interestShare)} color="from-violet-500 to-indigo-500" />
              <SummaryCard label="कुल कमाई" value={fc(stats.totalEarnings)} color="from-teal-500 to-cyan-500" />
              <SummaryCard label="बचत शेष" value={fc(stats.savingsBalance)} color="from-emerald-500 to-teal-500" />
              <SummaryCard label="ग्रैंड टोटल" value={fc(stats.grandTotal)} color="from-primary to-amber-500" />
              {stats.pendingPenalty > 0 && (
                <SummaryCard label="चल रहा जुर्माना" value={fc(stats.pendingPenalty)} color="from-red-500 to-rose-500" />
              )}
              {stats.pendingSavings > 0 && (
                <SummaryCard label="लंबित बचत" value={fc(stats.pendingSavings)} color="from-amber-400 to-yellow-500" />
              )}
              {data.guarantorLoans.length > 0 && (
                <div className="col-span-full">
                  <h3 className="font-heading font-black mb-2 flex items-center gap-2 text-amber-700">
                    <Shield className="w-5 h-5" /> गारंटर बने ({data.guarantorLoans.length})
                  </h3>
                  <div className="space-y-1">
                    {data.guarantorLoans.map((gl) => (
                      <p key={gl.id} className="text-sm bg-amber-50 p-2 rounded-xl border border-amber-200">
                        {gl.memberName} • {fc(gl.amount)} • {t(gl.status)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'loans' && (
            <div className="space-y-3" data-testid="detail-loans">
              {data.loans.length === 0 ? <p className="text-muted-foreground text-center py-8">{t('noData')}</p> :
                data.loans.map((l) => (
                  <div key={l.id} className="p-4 rounded-2xl border-2 border-border bg-white" data-testid={`detail-loan-${l.id}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-heading font-black text-lg">{fc(l.amount)}</p>
                        <p className="text-xs text-muted-foreground">{l.months} mo • EMI {fc(l.emiAmount)} • {fd(l.openingDate)}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="pill bg-primary/10 text-primary">{t(l.status)}</span>
                          {l.guarantorName && <span className="pill bg-amber-100 text-amber-700">गारंटर: {l.guarantorName}</span>}
                          {l.isOldLoan && <span className="pill bg-violet-100 text-violet-700">Old</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {l.status === 'pending' && (
                          <button onClick={() => approveLoan(l.id)} className="btn-3d-success py-1 px-3 text-xs">Approve</button>
                        )}
                        <button onClick={() => deleteLoan(l.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" data-testid={`detail-delete-loan-${l.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tab === 'contributions' && (
            <div data-testid="detail-contributions">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="text-left p-2">Month</th><th className="text-left p-2">{t('amount')}</th><th className="text-left p-2">Penalty</th><th className="text-left p-2">{t('paidDate')}</th><th></th></tr></thead>
                <tbody>
                  {data.contributions.length === 0 ? <tr><td colSpan="5" className="text-center text-muted-foreground py-6">{t('noData')}</td></tr> :
                    data.contributions.map((c) => (
                      <tr key={c.id} className="border-t" data-testid={`detail-contrib-${c.id}`}>
                        <td className="p-2 font-bold">{c.month}</td>
                        <td className="p-2 text-primary font-bold">{fc(c.amount)}</td>
                        <td className="p-2 text-amber-700">{c.penalty > 0 ? fc(c.penalty) : '-'}</td>
                        <td className="p-2 text-xs">{fd(c.paidDate)}</td>
                        <td className="p-2">
                          <button onClick={() => deleteContrib(c.id)} className="p-1 rounded-lg bg-red-50 text-red-600" data-testid={`detail-delete-contrib-${c.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'savings' && (
            <div data-testid="detail-savings">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="text-left p-2">Type</th><th className="text-left p-2">{t('amount')}</th><th className="text-left p-2">Desc</th><th className="text-left p-2">Date</th><th className="text-left p-2">Status</th><th></th></tr></thead>
                <tbody>
                  {data.savings.length === 0 ? <tr><td colSpan="6" className="text-center text-muted-foreground py-6">{t('noData')}</td></tr> :
                    data.savings.map((s) => (
                      <tr key={s.id} className="border-t" data-testid={`detail-savings-${s.id}`}>
                        <td className="p-2"><span className={`pill text-[10px] ${s.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{s.type}</span></td>
                        <td className={`p-2 font-bold ${s.type === 'deposit' ? 'text-emerald-600' : 'text-red-500'}`}>{fc(s.amount)}</td>
                        <td className="p-2 text-xs">{s.description}</td>
                        <td className="p-2 text-xs">{fd(s.date)}</td>
                        <td className="p-2"><span className={`pill text-[10px] ${s.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{s.status}</span></td>
                        <td className="p-2">
                          <button onClick={() => deleteSavings(s.id)} className="p-1 rounded-lg bg-red-50 text-red-600" data-testid={`detail-delete-savings-${s.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'penalties' && (
            <div data-testid="detail-penalties">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="text-left p-2">Type</th><th className="text-left p-2">{t('amount')}</th><th className="text-left p-2">Days Late</th><th className="text-left p-2">Date</th></tr></thead>
                <tbody>
                  {data.penalties.length === 0 ? <tr><td colSpan="4" className="text-center text-muted-foreground py-6">{t('noData')}</td></tr> :
                    data.penalties.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2 capitalize">{p.type}</td>
                        <td className="p-2 text-amber-700 font-bold">{fc(p.amount)}</td>
                        <td className="p-2">{p.daysLate}</td>
                        <td className="p-2 text-xs">{fd(p.date)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className={`card-clay bg-gradient-to-br ${color} text-white p-4`}>
      <p className="text-xs font-bold opacity-90">{label}</p>
      <p className="text-xl font-heading font-black mt-1">{value}</p>
    </div>
  );
}
