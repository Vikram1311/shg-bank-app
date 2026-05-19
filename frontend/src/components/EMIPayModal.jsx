import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { X, Calculator } from 'lucide-react';

export default function EMIPayModal({ loan, emi, onClose, onSuccess }) {
  const { t, fc } = useApp();
  const [amount, setAmount] = useState(emi.amount);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [applyPenalty, setApplyPenalty] = useState(true);
  const [loading, setLoading] = useState(false);

  const diff = Number(amount) - emi.amount;

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await api.post('/loans/emi-pay', {
        loanId: loan.id,
        emiNumber: emi.emiNumber,
        paidDate,
        applyPenalty,
        flexibleAmount: Number(amount) === emi.amount ? null : Number(amount),
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
      <div className="card-3d max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="emi-pay-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> EMI #{emi.emiNumber} भुगतान
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-muted/40">
            <p className="text-xs text-muted-foreground font-bold">सदस्य</p>
            <p className="font-heading font-black">{loan.memberName}</p>
            <p className="text-xs text-muted-foreground mt-1">EMI Amount: <span className="font-bold text-foreground">{fc(emi.amount)}</span></p>
          </div>

          <div>
            <label className="text-sm font-bold mb-1 block">Actual paid amount (₹)</label>
            <input
              type="number"
              className="input-3d text-lg font-heading font-black"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              data-testid="emi-pay-amount-input"
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 कस्टम amount डाल सकते हैं (e.g., सदस्य ₹3000 दे रहा है तो वही दर्ज करें)
            </p>
            {diff !== 0 && (
              <p className={`text-xs font-bold mt-1 ${diff > 0 ? 'text-emerald-600' : 'text-amber-700'}`} data-testid="emi-diff-info">
                {diff > 0 ? `+${fc(diff)} अतिरिक्त (principal में जाएगा)` : `${fc(diff)} कम भुगतान`}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-bold mb-1 block">भुगतान तिथि</label>
            <input type="date" className="input-3d" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} data-testid="emi-pay-date" />
          </div>

          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={applyPenalty} onChange={(e) => setApplyPenalty(e.target.checked)} className="w-5 h-5 accent-primary" data-testid="emi-apply-penalty" />
            देरी पर जुर्माना लागू करें
          </label>

          <button onClick={submit} disabled={loading} className="btn-3d-success w-full" data-testid="emi-pay-submit-btn">
            {loading ? t('loading') : `${fc(Number(amount) || 0)} भुगतान करें`}
          </button>
        </div>
      </div>
    </div>
  );
}
