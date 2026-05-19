import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { Calculator, Send, X, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LoanApplyModal({ open, onClose, memberId, onSuccess, canApply, blockReason }) {
  const { t, fc, settings } = useApp();
  const [amount, setAmount] = useState(5000);
  const [months, setMonths] = useState(3);
  const [guarantorId, setGuarantorId] = useState('');
  const [guarantors, setGuarantors] = useState([]);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const maxLoan = settings?.maxLoanAmount || 15000;
  const maxWithGuarantor = settings?.maxLoanAmountWithGuarantor || 30000;
  const needsGuarantor = Number(amount) > maxLoan;

  // Clamp amount when modal opens or limits change
  useEffect(() => {
    if (!open) return;
    const n = Number(amount);
    if (!Number.isFinite(n)) return;
    if (n > maxWithGuarantor) setAmount(maxWithGuarantor);
    else if (n < 500) setAmount(500);
  }, [open, maxWithGuarantor]);

  useEffect(() => {
    if (!open) return;
    api.get(`/loans/eligible-guarantors/${memberId}`).then((r) => setGuarantors(r.data)).catch(() => setGuarantors([]));
  }, [open, memberId]);

  useEffect(() => {
    if (!open || !amount || !months) return;
    const amt = Number(amount);
    const mo = Number(months);
    // Skip API calls for invalid/out-of-range values
    if (!Number.isFinite(amt) || amt < 500 || amt > maxWithGuarantor || mo < 1 || mo > 6) {
      return;
    }
    // Debounce + sequence guard to avoid stale responses overwriting newer ones
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.post('/loans/calculator',
        { memberId, amount: amt, months: mo },
        { signal: controller.signal }
      )
        .then(r => setDetails(r.data))
        .catch((err) => {
          if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
            setDetails(null);
          }
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [amount, months, open, memberId, maxWithGuarantor]);

  const submit = async () => {
    if (!canApply) {
      toast.error(blockReason === 'guarantor_block_75'
        ? 'आप किसी सक्रिय ऋण के गारंटर हैं। 75% भुगतान तक नया ऋण नहीं मिलेगा।'
        : t('notEligibleLoan'));
      return;
    }
    if (needsGuarantor && !guarantorId) {
      toast.error(`₹${maxLoan} से अधिक ऋण के लिए गारंटर चुनें`);
      return;
    }
    setLoading(true);
    try {
      await api.post('/loans/apply', {
        memberId, amount: Number(amount), months: Number(months),
        guarantorId: needsGuarantor ? guarantorId : null,
      });
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
            ⚠️ {blockReason === 'guarantor_block_75'
              ? 'आप किसी सक्रिय ऋण के गारंटर हैं। 75% भुगतान तक नया ऋण नहीं मिलेगा।'
              : t('notEligibleLoan')}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold mb-2 block">
              {t('loanAmount')} ({fc(500)} - {fc(maxWithGuarantor)})
            </label>
            <input
              type="range"
              min="500"
              max={maxWithGuarantor}
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
              max={maxWithGuarantor}
              data-testid="loan-amount-input"
            />
            {needsGuarantor && (
              <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                ₹{maxLoan} से अधिक के लिए गारंटर अनिवार्य है
              </div>
            )}
          </div>

          {needsGuarantor && (
            <div data-testid="guarantor-selector">
              <label className="text-sm font-bold mb-2 block flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                गारंटर चुनें (Guarantor)
              </label>
              <select
                className="input-3d"
                value={guarantorId}
                onChange={(e) => setGuarantorId(e.target.value)}
                data-testid="guarantor-select"
              >
                <option value="">-- {t('selectMember')} --</option>
                {guarantors.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.mobile})</option>
                ))}
              </select>
              {guarantors.length === 0 && (
                <p className="text-xs text-red-600 font-bold mt-1">कोई पात्र गारंटर उपलब्ध नहीं</p>
              )}
            </div>
          )}

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
