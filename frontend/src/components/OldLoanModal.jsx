import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { X, FileClock } from 'lucide-react';

export default function OldLoanModal({ members, onClose, onSuccess }) {
  const { t, fc } = useApp();
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [months, setMonths] = useState(3);
  const [interestRate, setInterestRate] = useState(2);
  const [includeInterest, setIncludeInterest] = useState(true);
  const [includeInApp, setIncludeInApp] = useState(true);
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!memberId || !amount || !openingDate) return;
    setLoading(true);
    try {
      await api.post('/loans/old', {
        memberId,
        amount: Number(amount),
        openingDate,
        closingDate: isClosed ? closingDate : null,
        months: Number(months),
        interestRate: Number(interestRate),
        includeInterest,
        includeInApp,
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
      <div className="card-3d max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="old-loan-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl flex items-center gap-2">
            <FileClock className="w-6 h-6 text-violet-600" /> {t('addOldLoan')}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold">{t('selectMember')}</label>
            <select className="input-3d" value={memberId} onChange={(e) => setMemberId(e.target.value)} data-testid="old-loan-member">
              <option value="">-- --</option>
              {members.filter((m) => !m.isAdmin && m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold">{t('loanAmount')}</label>
              <input type="number" className="input-3d" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="old-loan-amount" />
            </div>
            <div>
              <label className="text-xs font-bold">{t('months')}</label>
              <input type="number" min="1" max="60" className="input-3d" value={months} onChange={(e) => setMonths(e.target.value)} data-testid="old-loan-months" />
            </div>
            <div>
              <label className="text-xs font-bold">{t('openingDate')}</label>
              <input type="date" className="input-3d" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} data-testid="old-loan-opening" />
            </div>
            <div>
              <label className="text-xs font-bold">{t('interestRate')} (%)</label>
              <input type="number" step="0.1" className="input-3d" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} data-testid="old-loan-rate" />
            </div>
          </div>

          {/* Status toggle */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setIsClosed(false)}
              className={`flex-1 py-2 rounded-xl font-bold text-sm ${!isClosed ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' : 'bg-muted'}`}
              data-testid="old-loan-running-btn"
            >
              Running (चालू)
            </button>
            <button
              onClick={() => setIsClosed(true)}
              className={`flex-1 py-2 rounded-xl font-bold text-sm ${isClosed ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' : 'bg-muted'}`}
              data-testid="old-loan-closed-btn"
            >
              Closed (बंद)
            </button>
          </div>

          {isClosed && (
            <div>
              <label className="text-xs font-bold">{t('closingDate')}</label>
              <input type="date" className="input-3d" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} data-testid="old-loan-closing" />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={includeInterest} onChange={(e) => setIncludeInterest(e.target.checked)} className="w-5 h-5 accent-primary" data-testid="old-loan-with-interest" />
            ब्याज सहित गणना करें
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={includeInApp} onChange={(e) => setIncludeInApp(e.target.checked)} className="w-5 h-5 accent-primary" data-testid="old-loan-include-in-app" />
            सदस्यों के साथ ब्याज share करें
          </label>

          <button onClick={submit} disabled={loading} className="btn-3d-primary w-full" data-testid="old-loan-submit-btn">
            {loading ? t('loading') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
