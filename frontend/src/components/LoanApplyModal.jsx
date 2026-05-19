import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { Calculator, Send, X } from 'lucide-react';
import { toast } from 'sonner';

export default function LoanApplyModal({ open, onClose, memberId, onSuccess, canApply }) {
  const { t, fc, settings } = useApp();
  const [amount, setAmount] = useState(5000);
  const [months, setMonths] = useState(3);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const maxLoan = settings?.maxLoanAmount || 15000;

  useEffect(() => {
    if (!open || !amount || !months) return;
    api.post('/loans/calculator', { memberId, amount: Number(amount), months: Number(months) })
      .then(r => setDetails(r.data))
      .catch(() => setDetails(null));
  }, [amount, months, open, memberId]);

  const submit = async () => {
    if (!canApply) {
      toast.error(t('notEligibleLoan'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/loans/apply', { memberId, amount: Number(amount), months: Number(months) });
      toast.success(t('requestSent'));
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-scale-in" onClick={onClose}>
      <div className="card-3d max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="loan-apply-modal">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-2xl font-black flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary" />
            {t('applyLoan')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted" data-testid="loan-modal-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!canApply && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 border-2 border-red-200 text-red-800 text-sm font-bold" data-testid="loan-not-eligible-warn">
            ⚠️ {t('notEligibleLoan')}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold mb-2 block">{t('loanAmount')} (max ₹{maxLoan})</label>
            <input
              type="range"
              min="500"
              max={maxLoan}
              step="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full accent-primary"
              data-testid="loan-amount-slider"
            />
            <input
              type="number"
              className="input-3d mt-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="500"
              max={maxLoan}
              data-testid="loan-amount-input"
            />
          </div>
          <div>
            <label className="text-sm font-bold mb-2 block">{t('selectMonths')}</label>
            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`loan-months-${m}-btn`}
                  onClick={() => setMonths(m)}
                  className={`py-3 rounded-xl font-black transition-all ${
                    months === m
                      ? 'bg-primary text-primary-foreground shadow-[0_3px_0_0_#be123c]'
                      : 'bg-muted text-foreground hover:bg-muted/70'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {details && (
            <div className="card-clay bg-gradient-to-br from-amber-50 to-pink-50 border-2 border-white" data-testid="loan-calculator-result">
              <h3 className="font-heading font-black mb-3">{t('paymentDetails')}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/80 p-3 rounded-xl">
                  <p className="text-xs text-muted-foreground font-bold">{t('emiAmount')}</p>
                  <p className="text-lg font-heading font-black text-primary">{fc(details.emi)}</p>
                </div>
                <div className="bg-white/80 p-3 rounded-xl">
                  <p className="text-xs text-muted-foreground font-bold">{t('totalPayable')}</p>
                  <p className="text-lg font-heading font-black text-accent">{fc(details.totalPayable)}</p>
                </div>
                <div className="bg-white/80 p-3 rounded-xl col-span-2">
                  <p className="text-xs text-muted-foreground font-bold">{t('totalInterest')}</p>
                  <p className="text-lg font-heading font-black text-amber-600">{fc(details.totalInterest)}</p>
                </div>
              </div>
              {details.breakdown && (
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr><th className="p-1">EMI</th><th className="p-1">{t('amount')}</th><th className="p-1">Principal</th><th className="p-1">Interest</th></tr>
                    </thead>
                    <tbody className="font-semibold">
                      {details.breakdown.map((b) => (
                        <tr key={b.emiNumber} className="border-t border-amber-100">
                          <td className="p-1">{b.emiNumber}</td>
                          <td className="p-1">{fc(b.amount)}</td>
                          <td className="p-1">{fc(b.principal)}</td>
                          <td className="p-1 text-amber-700">{fc(b.interest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <button onClick={submit} disabled={loading || !canApply} className="btn-3d-primary w-full flex items-center justify-center gap-2 text-lg" data-testid="loan-submit-btn">
            <Send className="w-5 h-5" />
            {loading ? t('loading') : t('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
