import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { Briefcase, Plus, Trash2 } from 'lucide-react';
import PersonalLoanModal from './PersonalLoanModal';

export default function PersonalLoansTab({ members, onChange }) {
  const { t, fc, fd } = useApp();
  const [loans, setLoans] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const r = await api.get('/loans');
    setLoans(r.data.filter((l) => l.isPersonal));
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/loans/${id}`);
      toast.success(t('success'));
      load();
      onChange?.();
    } catch { toast.error(t('error')); }
  };

  const total = loans.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-4 animate-slide-up" data-testid="personal-loans-tab">
      <div className="card-3d p-6 bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-heading font-black text-2xl flex items-center gap-2">
              <Briefcase className="w-7 h-7 text-indigo-600" /> व्यक्तिगत ऋण
            </h2>
            <p className="text-sm text-muted-foreground font-semibold">
              Total: <span className="text-indigo-700 font-black text-lg">{fc(total)}</span>
              <span className="ml-2 text-xs">• Group interest/penalty share से बाहर</span>
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-3d-accent flex items-center gap-2" data-testid="add-personal-loan-btn">
            <Plus className="w-4 h-4" /> नया Personal Loan
          </button>
        </div>
      </div>

      {loans.length === 0 ? (
        <div className="card-3d p-10 text-center">
          <Briefcase className="w-16 h-16 mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-muted-foreground">कोई personal loan नहीं</p>
        </div>
      ) : (
        loans.map((l) => (
          <div key={l.id} className="card-3d p-5" data-testid={`personal-loan-${l.id}`}>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex-1">
                <p className="font-heading font-black text-lg">{l.memberName}</p>
                <p className="text-sm text-muted-foreground">{fc(l.amount)} • {l.months} mo @ {l.interestRate}% • EMI {fc(l.emiAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">Opening: {fd(l.openingDate)}{l.closingDate ? ` • Closed: ${fd(l.closingDate)}` : ''}</p>
                <div className="flex gap-2 mt-2">
                  <span className="pill bg-indigo-100 text-indigo-700">{t(l.status)}</span>
                  <span className="pill bg-violet-100 text-violet-700">Personal</span>
                  <span className="pill bg-amber-100 text-amber-700">Total: {fc(l.totalPayable)}</span>
                </div>
              </div>
              <button onClick={() => remove(l.id)} className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100" data-testid={`delete-personal-loan-${l.id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {l.emiHistory?.length > 0 && (
              <details className="mt-3">
                <summary className="font-bold text-sm cursor-pointer text-primary">EMI Schedule ↓</summary>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs">
                    <thead><tr className="text-muted-foreground"><th className="text-left p-1">#</th><th className="text-left p-1">Amount</th><th className="text-left p-1">Due</th><th className="text-left p-1">Status</th></tr></thead>
                    <tbody>
                      {l.emiHistory.map((e) => (
                        <tr key={e.id} className="border-t">
                          <td className="p-1">{e.emiNumber}</td>
                          <td className="p-1">{fc(e.amount)}</td>
                          <td className="p-1">{fd(e.dueDate)}</td>
                          <td className="p-1"><span className={`pill text-[10px] ${e.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t(e.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        ))
      )}

      {showAdd && <PersonalLoanModal members={members} onClose={() => setShowAdd(false)} onSuccess={() => { load(); onChange?.(); }} />}
    </div>
  );
}
