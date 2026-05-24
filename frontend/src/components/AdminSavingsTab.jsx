import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { PiggyBank, Plus, Sparkles, Edit, Trash2, X, ArrowDownCircle, ArrowUpCircle, Clock, Check } from 'lucide-react';

export default function AdminSavingsTab({ members }) {
  const { t, fc, fd } = useApp();
  const [txns, setTxns] = useState([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [filterMember, setFilterMember] = useState('');
  const [distributing, setDistributing] = useState(false);

  const load = async () => {
    const r = await api.get('/savings');
    setTxns(r.data.sort((a, b) => b.date.localeCompare(a.date)));
  };

  useEffect(() => { load(); }, []);

  const distributeInterest = async () => {
    setDistributing(true);
    try {
      const r = await api.post('/savings/distribute-interest');
      if (r.data.totalMembers === 0) {
        toast.success('सभी सदस्यों का ब्याज पहले से जमा है ✓ (auto-distribute हो रहा है)');
      } else {
        toast.success(`${r.data.totalMembers} सदस्यों को बचा हुआ ब्याज जमा हुआ ✓`);
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setDistributing(false); }
  };

  const distributeSavingsInterest = async () => {
    if (!window.confirm('मासिक बचत ब्याज (7.25% सालाना) सभी सदस्यों को वितरित करें?')) return;
    setDistributing(true);
    try {
      const r = await api.post('/savings/distribute-savings-interest');
      toast.success(`${r.data.totalMembers} सदस्यों को मासिक बचत ब्याज जमा हुआ (${r.data.monthlyRate}% मासिक)`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setDistributing(false); }
  };

  const remove = async (tx) => {
    const msg = `क्या आप ${tx.memberName} का ${tx.type === 'deposit' ? 'जमा' : 'निकासी'} ₹${tx.amount} (${tx.description || '-'}) सच में delete करना चाहते हैं?\n\nयह action वापस नहीं होगा।`;
    if (!window.confirm(msg)) return;
    try {
      await api.delete(`/savings/${tx.id}`);
      toast.success(`${tx.memberName} की entry delete हो गयी ✓`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    }
  };

  const approve = async (id) => {
    try {
      await api.post(`/savings/${id}/approve`);
      toast.success('स्वीकृत');
      load();
    } catch { toast.error(t('error')); }
  };

  const reject = async (id) => {
    if (!window.confirm('Reject this deposit?')) return;
    try {
      await api.post(`/savings/${id}/reject`);
      toast.success('अस्वीकृत');
      load();
    } catch { toast.error(t('error')); }
  };

  // Aggregate balances - only approved
  const balances = {};
  txns.forEach((tx) => {
    if (tx.status !== 'approved') return;
    balances[tx.memberId] = (balances[tx.memberId] || 0) + (tx.type === 'deposit' ? tx.amount : -tx.amount);
  });
  const totalSavings = Object.values(balances).reduce((a, b) => a + b, 0);
  const pendingTxns = txns.filter((tx) => tx.status === 'pending');

  const filteredTxns = filterMember ? txns.filter((tx) => tx.memberId === filterMember) : txns;

  return (
    <div className="space-y-4 animate-slide-up" data-testid="admin-savings-tab">
      {/* Top actions */}
      <div className="card-3d p-6 bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-heading font-black text-2xl flex items-center gap-2">
              <PiggyBank className="w-7 h-7 text-emerald-600" /> {t('savings')}
            </h2>
            <p className="text-sm text-muted-foreground font-semibold">Total: <span className="text-emerald-700 font-black text-lg">{fc(totalSavings)}</span></p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowDepositModal(true)} className="btn-3d-success flex items-center gap-2" data-testid="admin-savings-deposit-btn">
              <Plus className="w-4 h-4" /> Deposit
            </button>
            <button onClick={() => setShowWithdrawModal(true)} className="btn-3d-danger flex items-center gap-2" data-testid="admin-savings-withdraw-btn">
              <ArrowUpCircle className="w-4 h-4" /> Withdraw
            </button>
            <button onClick={distributeInterest} disabled={distributing} className="btn-3d-accent flex items-center gap-2" data-testid="distribute-interest-btn">
              <Sparkles className="w-4 h-4" /> {distributing ? t('loading') : 'ब्याज वितरण (Loan)'}
            </button>
            <button onClick={distributeSavingsInterest} disabled={distributing} className="btn-3d-primary flex items-center gap-2" data-testid="distribute-savings-interest-btn">
              <Sparkles className="w-4 h-4" /> मासिक बचत ब्याज (7.25%)
            </button>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingTxns.length > 0 && (
        <div className="card-3d p-6 border-2 border-amber-300 bg-amber-50/50" data-testid="pending-savings-section">
          <h3 className="font-heading font-black text-lg mb-3 text-amber-800 flex items-center gap-2">
            <Clock className="w-5 h-5" /> लंबित approvals ({pendingTxns.length})
          </h3>
          <div className="space-y-2">
            {pendingTxns.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/80 gap-2 flex-wrap" data-testid={`pending-deposit-${tx.id}`}>
                <div>
                  <p className="font-bold">{tx.memberName}</p>
                  <p className="text-xs text-muted-foreground">{tx.description} • {fd(tx.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-heading font-black text-lg text-emerald-600">+{fc(tx.amount)}</p>
                  <button onClick={() => approve(tx.id)} className="btn-3d-success py-2 px-3 text-xs" data-testid={`approve-savings-${tx.id}`}>
                    <Check className="w-4 h-4 inline" /> Approve
                  </button>
                  <button onClick={() => reject(tx.id)} className="btn-3d-danger py-2 px-3 text-xs" data-testid={`reject-savings-${tx.id}`}>
                    <X className="w-4 h-4 inline" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member balance grid */}
      <div className="card-3d p-6">
        <h3 className="font-heading font-black text-lg mb-3">सदस्य-वार बचत शेष</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {members.filter((m) => m.isActive).map((m) => (
            <div key={m.id}
              onClick={() => setFilterMember(filterMember === m.id ? '' : m.id)}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${filterMember === m.id ? 'border-primary bg-primary/5' : 'border-border bg-white'}`}
              data-testid={`savings-balance-${m.id}`}
            >
              <p className="text-xs font-bold truncate">{m.name}</p>
              <p className="text-base font-heading font-black text-emerald-700">{fc(balances[m.id] || 0)}</p>
            </div>
          ))}
        </div>
        {filterMember && (
          <button onClick={() => setFilterMember('')} className="mt-2 text-xs font-bold text-primary" data-testid="clear-filter-btn">Clear filter ✕</button>
        )}
      </div>

      {/* Transactions table */}
      <div className="card-3d p-4 sm:p-6">
        <h3 className="font-heading font-black text-lg mb-3">लेन-देन ({filteredTxns.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-emerald-100 to-teal-100">
              <tr>
                <th className="text-left p-2 font-bold">{t('name')}</th>
                <th className="text-left p-2 font-bold">Type</th>
                <th className="text-left p-2 font-bold">{t('amount')}</th>
                <th className="text-left p-2 font-bold">Description</th>
                <th className="text-left p-2 font-bold">Date</th>
                <th className="text-left p-2 font-bold">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.slice(0, 100).map((tx) => (
                <tr key={tx.id} className="border-t border-border/60" data-testid={`admin-savings-row-${tx.id}`}>
                  <td className="p-2 font-bold">{tx.memberName}</td>
                  <td className="p-2">
                    <span className={`pill ${tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {tx.type === 'deposit' ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                      {tx.type}
                    </span>
                    {tx.status === 'pending' && (
                      <span className="pill ml-1 bg-amber-100 text-amber-800 text-[10px]">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </td>
                  <td className={`p-2 font-bold ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}{fc(tx.amount)}
                  </td>
                  <td className="p-2 text-xs">{tx.description}</td>
                  <td className="p-2 text-xs">{fd(tx.date)}</td>
                  <td className="p-2 flex gap-1">
                    <button onClick={() => setEditingTxn(tx)} className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100" data-testid={`edit-savings-${tx.id}`}>
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(tx)} className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" data-testid={`delete-savings-${tx.id}`} title="entry delete करें">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTxns.length === 0 && (
                <tr><td colSpan="6" className="text-center text-muted-foreground p-6">{t('noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDepositModal && <SavingsTxnModal type="deposit" members={members.filter((m) => m.isActive)} onClose={() => setShowDepositModal(false)} onSuccess={load} />}
      {showWithdrawModal && <SavingsTxnModal type="withdraw" members={members.filter((m) => m.isActive)} onClose={() => setShowWithdrawModal(false)} onSuccess={load} />}
      {editingTxn && <EditSavingsModal txn={editingTxn} onClose={() => setEditingTxn(null)} onSuccess={load} />}
    </div>
  );
}

function SavingsTxnModal({ type, members, onClose, onSuccess }) {
  const { t } = useApp();
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!memberId || !amount) return;
    setLoading(true);
    try {
      await api.post(`/savings/${type === 'deposit' ? 'deposit' : 'withdraw'}`, {
        memberId, amount: Number(amount), date: new Date().toISOString().slice(0, 10), description,
      });
      toast.success(t('success'));
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-3d max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid={`savings-${type}-modal`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl">{type === 'deposit' ? 'जमा' : 'निकासी'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <select className="input-3d" value={memberId} onChange={(e) => setMemberId(e.target.value)} data-testid="savings-member-select">
            <option value="">-- {t('selectMember')} --</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="number" className="input-3d" placeholder={t('amount')} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="savings-amount-input" />
          <input type="text" className="input-3d" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="savings-desc-input" />
          <button onClick={submit} disabled={loading} className={`${type === 'deposit' ? 'btn-3d-success' : 'btn-3d-danger'} w-full`} data-testid="savings-submit-btn">
            {loading ? t('loading') : t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditSavingsModal({ txn, onClose, onSuccess }) {
  const { t } = useApp();
  const [amount, setAmount] = useState(txn.amount);
  const [date, setDate] = useState(txn.date);
  const [description, setDescription] = useState(txn.description || '');
  const [type, setType] = useState(txn.type);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await api.put(`/savings/${txn.id}`, { amount: Number(amount), date, description, type });
      toast.success(t('success'));
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setLoading(false); }
  };

  const deleteEntry = async () => {
    const msg = `क्या आप ${txn.memberName} का ${txn.type === 'deposit' ? 'जमा' : 'निकासी'} ₹${txn.amount} (${txn.description || '-'}) सच में delete करना चाहते हैं?\n\nयह action वापस नहीं होगा।`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      await api.delete(`/savings/${txn.id}`);
      toast.success(`${txn.memberName} की entry delete हो गयी ✓`);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-3d max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="edit-savings-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl">Edit Transaction</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="bg-muted/40 rounded-xl p-2 text-xs font-bold">
            <span className="text-muted-foreground">सदस्य:</span> {txn.memberName}
          </div>
          <div>
            <label className="text-xs font-bold">Type</label>
            <select className="input-3d" value={type} onChange={(e) => setType(e.target.value)} data-testid="edit-savings-type">
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold">{t('amount')}</label>
            <input type="number" className="input-3d" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="edit-savings-amount" />
          </div>
          <div>
            <label className="text-xs font-bold">Date</label>
            <input type="date" className="input-3d" value={date} onChange={(e) => setDate(e.target.value)} data-testid="edit-savings-date" />
          </div>
          <div>
            <label className="text-xs font-bold">Description</label>
            <input type="text" className="input-3d" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="edit-savings-desc" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={loading || deleting} className="btn-3d-primary flex-1" data-testid="edit-savings-save-btn">
              {loading ? t('loading') : t('save')}
            </button>
            <button onClick={deleteEntry} disabled={loading || deleting} className="px-4 py-3 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border-2 border-red-200 font-bold flex items-center gap-2" data-testid="edit-savings-delete-btn">
              <Trash2 className="w-4 h-4" />
              {deleting ? '...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
