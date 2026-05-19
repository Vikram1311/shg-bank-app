import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { X, AlertTriangle, PiggyBank, Wallet, ShieldAlert } from 'lucide-react';

// Single contribution modal
export function SingleContributionModal({ members, onClose, onSuccess }) {
  const { t } = useApp();
  const [memberId, setMemberId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [applyPenalty, setApplyPenalty] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      await api.post('/contributions', { memberId, month, paidDate, applyPenalty });
      toast.success(t('success'));
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-3d max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="single-contrib-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> मैनुअल योगदान
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold">{t('selectMember')}</label>
            <select className="input-3d" value={memberId} onChange={(e) => setMemberId(e.target.value)} data-testid="single-contrib-member">
              <option value="">-- --</option>
              {members.filter((m) => !m.isAdmin && m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold">{t('month')}</label>
              <input type="month" className="input-3d" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="single-contrib-month" />
            </div>
            <div>
              <label className="text-xs font-bold">{t('paidDate')}</label>
              <input type="date" className="input-3d" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} data-testid="single-contrib-date" />
            </div>
          </div>
          <label className="flex items-center gap-2 font-bold text-sm">
            <input type="checkbox" checked={applyPenalty} onChange={(e) => setApplyPenalty(e.target.checked)} className="w-5 h-5 accent-primary" data-testid="single-contrib-penalty-toggle" />
            {t('applyPenalty')}
          </label>
          <button onClick={submit} disabled={loading} className="btn-3d-primary w-full" data-testid="single-contrib-submit-btn">
            {loading ? t('loading') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Manual penalty modal
export function ManualPenaltyModal({ members, onClose, onSuccess }) {
  const { t } = useApp();
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [daysLate, setDaysLate] = useState(0);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!memberId || !amount) return;
    setLoading(true);
    try {
      await api.post('/penalties', {
        memberId, type: 'manual',
        amount: Number(amount),
        daysLate: Number(daysLate),
        date: new Date().toISOString().slice(0, 10),
        description,
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
      <div className="card-3d max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="manual-penalty-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" /> मैनुअल जुर्माना
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold">{t('selectMember')}</label>
            <select className="input-3d" value={memberId} onChange={(e) => setMemberId(e.target.value)} data-testid="manual-penalty-member">
              <option value="">-- --</option>
              {members.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold">{t('amount')} (₹)</label>
              <input type="number" className="input-3d" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="manual-penalty-amount" />
            </div>
            <div>
              <label className="text-xs font-bold">दिन देरी</label>
              <input type="number" className="input-3d" value={daysLate} onChange={(e) => setDaysLate(e.target.value)} min="0" data-testid="manual-penalty-days" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold">कारण (Description)</label>
            <input type="text" className="input-3d" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., देरी से जमा" data-testid="manual-penalty-desc" />
          </div>
          <button onClick={submit} disabled={loading} className="btn-3d-danger w-full" data-testid="manual-penalty-submit-btn">
            {loading ? t('loading') : 'जुर्माना लगाएं'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Quick Actions section
export default function QuickActionsCard({ members, onChange }) {
  const { t } = useApp();
  const [openContrib, setOpenContrib] = useState(false);
  const [openPenalty, setOpenPenalty] = useState(false);

  return (
    <div className="card-3d p-6" data-testid="quick-actions-card">
      <h3 className="font-heading font-black text-xl mb-4 flex items-center gap-2">
        <span className="w-2 h-7 bg-primary rounded-full" /> Quick Manual Entries
      </h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => setOpenContrib(true)} className="btn-3d-primary flex items-center justify-center gap-2" data-testid="quick-contrib-btn">
          <Wallet className="w-4 h-4" /> मैनुअल योगदान
        </button>
        <button onClick={() => setOpenPenalty(true)} className="btn-3d-danger flex items-center justify-center gap-2" data-testid="quick-penalty-btn">
          <ShieldAlert className="w-4 h-4" /> मैनुअल जुर्माना
        </button>
      </div>
      <p className="text-xs text-muted-foreground font-semibold mt-3">
        💡 EMI भुगतान Loans tab में, बचत जमा Savings tab में करें
      </p>
      {openContrib && <SingleContributionModal members={members} onClose={() => setOpenContrib(false)} onSuccess={onChange} />}
      {openPenalty && <ManualPenaltyModal members={members} onClose={() => setOpenPenalty(false)} onSuccess={onChange} />}
    </div>
  );
}
