import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { X, Briefcase, Calculator } from 'lucide-react';

export default function PersonalLoanModal({ members, onClose, onSuccess }) {
  const { t, fc } = useApp();
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState(6);
  const [interestRate, setInterestRate] = useState(2);
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().slice(0, 10));
  const [closingDate, setClosingDate] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Quick estimate
  const principal = Number(amount) || 0;
  const r = (Number(interestRate) || 0) / 100;
  const n = Number(months) || 1;
  const emiEstimate = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayable = emiEstimate * n;
  const totalInterest = totalPayable - principal;

  const submit = async () => {
    if (!memberId || !amount || !openingDate) return;
    setLoading(true);
    try {
      await api.post('/personal-loans', {
        memberId,
        amount: Number(amount),
        months: Number(months),
        interestRate: Number(interestRate),
        openingDate,
        closingDate: isClosed ? closingDate : null,
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
      <div className="card-3d max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="personal-loan-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" /> व्यक्तिगत ऋण (Personal Loan)
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground font-semibold mb-4">
          ℹ️ यह ऋण group के interest/penalty share से बाहर है — एक individual function।
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold">{t('selectMember')}</label>
            <select className="input-3d" value={memberId} onChange={(e) => setMemberId(e.target.value)} data-testid="pl-member">
              <option value="">-- --</option>
              {members.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold">{t('loanAmount')}</label>
              <input type="number" className="input-3d" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="pl-amount" />
            </div>
            <div>
              <label className="text-xs font-bold">{t('months')}</label>
              <input type="number" min="1" max="60" className="input-3d" value={months} onChange={(e) => setMonths(e.target.value)} data-testid="pl-months" />
            </div>
            <div>
              <label className="text-xs font-bold">{t('openingDate')}</label>
              <input type="date" className="input-3d" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} data-testid="pl-opening" />
            </div>
            <div>
              <label className="text-xs font-bold">{t('interestRate')} (% मासिक)</label>
              <input type="number" step="0.1" className="input-3d" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} data-testid="pl-rate" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setIsClosed(false)} className={`flex-1 py-2 rounded-xl font-bold text-sm ${!isClosed ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' : 'bg-muted'}`} data-testid="pl-running-btn">
              Running (चालू)
            </button>
            <button onClick={() => setIsClosed(true)} className={`flex-1 py-2 rounded-xl font-bold text-sm ${isClosed ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' : 'bg-muted'}`} data-testid="pl-closed-btn">
              Closed (बंद)
            </button>
          </div>

          {isClosed && (
            <div>
              <label className="text-xs font-bold">{t('closingDate')}</label>
              <input type="date" className="input-3d" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} data-testid="pl-closing" />
            </div>
          )}

          <div>
            <label className="text-xs font-bold">कारण / विवरण</label>
            <input type="text" className="input-3d" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Personal use" data-testid="pl-desc" />
          </div>

          {principal > 0 && (
            <div className="card-clay bg-gradient-to-br from-indigo-50 to-violet-50 p-3 border border-indigo-200" data-testid="pl-estimate">
              <h3 className="font-heading font-black mb-2 flex items-center gap-1 text-sm"><Calculator className="w-4 h-4" /> Estimate</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-muted-foreground">EMI</p><p className="font-bold text-indigo-700">{fc(emiEstimate)}</p></div>
                <div><p className="text-muted-foreground">Interest</p><p className="font-bold text-amber-700">{fc(totalInterest)}</p></div>
                <div><p className="text-muted-foreground">Total</p><p className="font-bold text-primary">{fc(totalPayable)}</p></div>
              </div>
            </div>
          )}

          <button onClick={submit} disabled={loading} className="btn-3d-primary w-full" data-testid="pl-submit-btn">
            {loading ? t('loading') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
