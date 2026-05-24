import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { X, Save, Trash2, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

export default function EMIEditModal({ loan, emi, onClose, onSuccess }) {
  const { t, fc } = useApp();
  const [amount, setAmount] = useState(emi.amount);
  const [dueDate, setDueDate] = useState((emi.dueDate || '').slice(0, 10));
  const [paidDate, setPaidDate] = useState((emi.paidDate || '').slice(0, 10));
  const [penalty, setPenalty] = useState(emi.penalty || 0);
  const [status, setStatus] = useState(emi.status);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const payload = {
        amount: Number(amount),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        paidDate: paidDate ? new Date(paidDate).toISOString() : null,
        penalty: Number(penalty) || 0,
        status,
      };
      await api.put(`/loans/${loan.id}/emi/${emi.id}`, payload);
      toast.success(`EMI #${emi.emiNumber} update हो गया ✓`);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-3d max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="emi-edit-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-xl flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-primary" /> EMI #{emi.emiNumber} संपादित करें
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-muted/40 rounded-xl p-3 text-xs font-bold mb-3">
          <div className="flex justify-between"><span>{loan.memberName}</span><span>Loan: {fc(loan.amount)}</span></div>
          <div className="flex justify-between text-muted-foreground mt-1">
            <span>Original EMI</span>
            <span>{fc(emi.amount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold mb-1 block">EMI राशि (₹)</label>
            <input type="number" step="0.01" className="input-3d" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="emi-edit-amount" />
          </div>

          <div>
            <label className="text-xs font-bold mb-1 block">Due Date (नियत तिथि)</label>
            <input type="date" className="input-3d" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="emi-edit-due-date" />
            <p className="text-[10px] text-muted-foreground mt-1">EMI का महीना/तारीख बदलने के लिए इसे change करें</p>
          </div>

          <div>
            <label className="text-xs font-bold mb-1 block">Status</label>
            <select className="input-3d" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="emi-edit-status">
              <option value="pending">Pending (बाकी)</option>
              <option value="paid">Paid (भुगतान हो गया)</option>
            </select>
          </div>

          {status === 'paid' && (
            <div>
              <label className="text-xs font-bold mb-1 block">Paid Date (भुगतान तिथि)</label>
              <input type="date" className="input-3d" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} data-testid="emi-edit-paid-date" />
            </div>
          )}

          <div>
            <label className="text-xs font-bold mb-1 block">जुर्माना (₹)</label>
            <input type="number" step="0.01" min="0" className="input-3d" value={penalty} onChange={(e) => setPenalty(e.target.value)} data-testid="emi-edit-penalty" />
            <p className="text-[10px] text-muted-foreground mt-1">अगर penalty नहीं लगानी तो 0 रखें</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={loading} className="btn-3d-primary flex-1 flex items-center justify-center gap-2" data-testid="emi-edit-save-btn">
              <Save className="w-4 h-4" />
              {loading ? t('loading') : t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
