import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { Wallet, Coins, AlertTriangle, Edit3, Check } from 'lucide-react';

export default function PaymentWidget({ stats }) {
  const { user, t, fc, settings } = useApp();
  const monthlyAmount = settings?.monthlyContribution || 1000;
  const upi = settings?.upiId || '9315341037@INDIE';

  const [loans, setLoans] = useState([]);
  const [selectedKey, setSelectedKey] = useState('contribution');
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    api.get('/loans', { params: { memberId: user.id } })
      .then((r) => setLoans(r.data.filter((l) => l.status === 'active')))
      .catch(() => {});
  }, [user.id]);

  // Build pay options
  const options = useMemo(() => {
    const opts = [];
    // Current month contribution if unpaid
    const currentMonth = stats?.currentMonth || new Date().toISOString().slice(0, 7);
    const isContribPaid = stats?.paidMonths?.includes(currentMonth);
    if (!isContribPaid) {
      opts.push({
        key: 'contribution',
        label: `${currentMonth} मासिक योगदान`,
        amount: monthlyAmount,
        icon: Wallet,
        color: 'from-pink-500 to-rose-500',
        note: t('dueDate') + ': 11 ' + currentMonth,
      });
    }
    // Active loan pending EMIs (first pending only per loan)
    loans.forEach((l) => {
      const pendingEmi = l.emiHistory.find((e) => e.status === 'pending');
      if (pendingEmi) {
        opts.push({
          key: `emi-${l.id}`,
          label: `EMI #${pendingEmi.emiNumber} (₹${Math.round(l.amount)} loan)`,
          amount: Math.round(pendingEmi.amount),
          icon: Coins,
          color: 'from-violet-500 to-indigo-500',
          note: `${l.months} mo loan • ${l.isPersonal ? 'Personal' : 'Group'}`,
        });
      }
    });
    // Pending penalty
    if (stats?.pendingPenalty > 0) {
      opts.push({
        key: 'penalty',
        label: 'चल रहा जुर्माना',
        amount: Math.ceil(stats.pendingPenalty),
        icon: AlertTriangle,
        color: 'from-red-500 to-orange-500',
        note: `${stats.pendingPenaltyItems?.length || 0} item${(stats.pendingPenaltyItems?.length || 0) > 1 ? 's' : ''}`,
      });
    }
    // Custom amount fallback
    opts.push({
      key: 'custom',
      label: 'अन्य राशि (Custom)',
      amount: 0,
      icon: Edit3,
      color: 'from-amber-500 to-yellow-500',
      note: 'अपनी राशि डालें',
      isCustom: true,
    });
    return opts;
  }, [loans, stats, monthlyAmount, t]);

  // Resolve selected option safely
  const selected = options.find((o) => o.key === selectedKey) || options[0];

  // Final amount for QR
  const finalAmount = selected?.isCustom ? (Number(customAmount) || 0) : (selected?.amount || 0);

  // UPI link
  const tn = selected?.isCustom ? `Payment ${user.name}` : `${selected.label} - ${user.name}`;
  const upiUrl = `upi://pay?pa=${upi}&pn=SHG%20BANK${finalAmount > 0 ? `&am=${finalAmount}` : ''}&cu=INR&tn=${encodeURIComponent(tn)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUrl)}&color=BE123C&bgcolor=FFFFFF&margin=10`;

  return (
    <div className="card-3d p-6" data-testid="payment-widget">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-black text-xl flex items-center gap-2">
          <span className="w-2 h-7 bg-primary rounded-full" /> भुगतान QR
        </h3>
        {finalAmount > 0 && (
          <span className="pill bg-primary/10 text-primary font-bold">₹{finalAmount}</span>
        )}
      </div>

      {/* Option chips */}
      <div className="space-y-2 mb-4">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selectedKey === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSelectedKey(opt.key)}
              className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-white hover:border-primary/40'
              }`}
              data-testid={`pay-option-${opt.key}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold">{opt.note}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!opt.isCustom && opt.amount > 0 && (
                  <span className="font-heading font-black text-base text-foreground">{fc(opt.amount)}</span>
                )}
                {isSelected && <Check className="w-4 h-4 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom amount input */}
      {selected?.isCustom && (
        <div className="mb-4" data-testid="custom-amount-section">
          <label className="text-xs font-bold mb-1 block">अपनी राशि डालें (₹)</label>
          <input
            type="number"
            className="input-3d text-lg font-heading font-black"
            placeholder="e.g., 1500"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            min="1"
            data-testid="custom-amount-input"
            autoFocus
          />
        </div>
      )}

      {/* QR Display */}
      <div className="flex flex-col items-center bg-gradient-to-br from-violet-50 via-pink-50 to-amber-50 rounded-2xl p-4 border-2 border-white">
        <img
          src={qrUrl}
          alt="UPI QR Code"
          className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl bg-white p-2 shadow-inner"
          data-testid="payment-qr-image"
        />
        <p className="text-xs text-muted-foreground mt-3 font-semibold">{t('scanToPay')}</p>
        <div className="mt-2 px-4 py-2 bg-white rounded-xl shadow-inner">
          <p className="text-sm font-bold text-primary tracking-wide" data-testid="payment-upi-id">{upi}</p>
        </div>
        {finalAmount > 0 ? (
          <p className="text-2xl font-heading font-black text-foreground mt-2" data-testid="payment-final-amount">
            ₹{finalAmount}
          </p>
        ) : (
          <p className="text-xs text-amber-600 mt-2 font-bold">
            {selected?.isCustom ? 'राशि डालें' : 'No amount selected'}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3 text-center">
        💡 भुगतान करने के बाद admin से entry update करवाएं
      </p>
    </div>
  );
}
