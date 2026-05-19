import React from 'react';
import { useApp } from '../contexts/AppContext';

export default function QRPayment({ amount, label }) {
  const { settings, t } = useApp();
  const upi = settings?.upiId || '9315341037@INDIE';
  const upiUrl = `upi://pay?pa=${upi}&pn=SHG%20BANK${amount ? `&am=${amount}` : ''}&cu=INR${label ? `&tn=${encodeURIComponent(label)}` : ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUrl)}&color=BE123C&bgcolor=FFFFFF&margin=10`;

  return (
    <div className="card-clay bg-gradient-to-br from-violet-100 via-pink-50 to-amber-50 border-2 border-white" data-testid="qr-payment">
      <h3 className="font-heading font-black text-lg mb-3 flex items-center gap-2">
        <span className="w-2 h-6 bg-primary rounded-full" />
        {t('qrPayment')}
      </h3>
      <div className="flex flex-col items-center bg-white rounded-2xl p-4 shadow-inner">
        <img src={qrUrl} alt="UPI QR Code" className="w-48 h-48 sm:w-56 sm:h-56" data-testid="qr-image" />
        <p className="text-xs text-muted-foreground mt-3 font-semibold">{t('scanToPay')}</p>
        <div className="mt-2 px-4 py-2 bg-primary/10 rounded-xl">
          <p className="text-sm font-bold text-primary tracking-wide" data-testid="upi-id">{upi}</p>
        </div>
        {amount && (
          <p className="text-lg font-heading font-black text-foreground mt-2">₹{amount}</p>
        )}
      </div>
    </div>
  );
}
