import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { PiggyBank, Plus, TrendingUp, ArrowDownCircle, ArrowUpCircle, Sparkles, Clock } from 'lucide-react';

export default function MemberSavingsTab() {
  const { user, t, fc, fd } = useApp();
  const [txns, setTxns] = useState([]);
  const [balance, setBalance] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingsRate, setSavingsRate] = useState(7.25);

  const load = async () => {
    try {
      const [tRes, bRes, sRes] = await Promise.all([
        api.get('/savings', { params: { memberId: user.id } }),
        api.get(`/savings/balance/${user.id}`),
        api.get('/settings'),
      ]);
      setTxns(tRes.data.sort((a, b) => b.date.localeCompare(a.date)));
      setBalance(bRes.data.balance);
      setPendingAmount(bRes.data.pendingAmount || 0);
      setSavingsRate(sRes.data?.savingsInterestRate || 7.25);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { load(); }, []);

  const deposit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await api.post('/savings/deposit', {
        memberId: user.id,
        amount: Number(amount),
        date: new Date().toISOString().slice(0, 10),
        description: description || 'Self deposit',
      });
      toast.success('जमा request भेज दिया - admin approval बाकी');
      setAmount('');
      setDescription('');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('error'));
    } finally { setLoading(false); }
  };

  const interestEarned = txns.filter((tx) => tx.status === 'approved' && tx.description?.startsWith('Interest auto-credit')).reduce((s, tx) => s + tx.amount, 0);

  return (
    <div className="space-y-6 animate-slide-up" data-testid="member-savings-tab">
      {/* Hero card */}
      <div className="card-3d p-6 sm:p-8 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-white/10" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center float-anim">
            <PiggyBank className="w-10 h-10" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold opacity-90">{t('mySavings')} - {t('savingsBalance')}</p>
            <p className="text-4xl sm:text-5xl font-heading font-black mt-1" data-testid="member-savings-balance">{fc(balance)}</p>
            <div className="flex flex-wrap gap-3 mt-1">
              {interestEarned > 0 && (
                <p className="text-sm font-semibold opacity-90 flex items-center gap-1">
                  <Sparkles className="w-4 h-4" /> ब्याज जमा: {fc(interestEarned)}
                </p>
              )}
              {pendingAmount > 0 && (
                <p className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full flex items-center gap-1" data-testid="pending-savings-badge">
                  <Clock className="w-4 h-4" /> लंबित: {fc(pendingAmount)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interest rate badge */}
      <div className="card-3d p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 flex items-center gap-3" data-testid="savings-interest-badge">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">वार्षिक ब्याज दर</p>
          <p className="font-heading font-black text-2xl text-amber-900">{savingsRate}% प्रति वर्ष</p>
          <p className="text-xs text-amber-800 font-semibold mt-0.5">आपकी बचत पर हर साल {savingsRate}% ब्याज मिलेगा</p>
        </div>
      </div>

      {/* Deposit form */}
      <div className="card-3d p-6">
        <h3 className="font-heading font-black text-xl mb-4 flex items-center gap-2">
          <span className="w-2 h-7 bg-emerald-500 rounded-full" />
          <Plus className="w-5 h-5 text-emerald-600" /> बचत जमा करें
        </h3>
        <p className="text-xs text-muted-foreground font-semibold mb-3">
          ℹ️ जमा करने के बाद Admin approval का इंतजार करें। Approval के बाद ही balance में जुड़ेगा।
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="number"
            className="input-3d"
            placeholder={`${t('amount')} (₹)`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            data-testid="savings-deposit-amount"
          />
          <input
            type="text"
            className="input-3d"
            placeholder="विवरण (वैकल्पिक)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="savings-deposit-desc"
          />
        </div>
        <button onClick={deposit} disabled={loading} className="btn-3d-success mt-4 flex items-center gap-2" data-testid="savings-deposit-btn">
          <Plus className="w-4 h-4" />
          {loading ? t('loading') : 'जमा request भेजें'}
        </button>
      </div>

      {/* Transactions */}
      <div className="card-3d p-4 sm:p-6">
        <h3 className="font-heading font-black text-xl mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" /> {t('contribHistory')}
        </h3>
        {txns.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">{t('noData')}</p>
        ) : (
          <div className="space-y-2" data-testid="savings-txns-list">
            {txns.map((tx) => {
              const isPending = tx.status === 'pending';
              return (
                <div key={tx.id} className={`flex items-center justify-between p-3 rounded-2xl ${isPending ? 'bg-amber-50 border-2 border-amber-200' : 'bg-muted/30 hover:bg-muted/50'}`} data-testid={`savings-txn-${tx.id}`}>
                  <div className="flex items-center gap-3">
                    {tx.type === 'deposit' ? (
                      <ArrowDownCircle className={`w-8 h-8 ${isPending ? 'text-amber-600' : 'text-emerald-600'}`} />
                    ) : (
                      <ArrowUpCircle className="w-8 h-8 text-red-500" />
                    )}
                    <div>
                      <p className="font-bold text-sm flex items-center gap-2">
                        {tx.description || (tx.type === 'deposit' ? 'जमा' : 'निकासी')}
                        {isPending && (
                          <span className="pill bg-amber-200 text-amber-900 text-[10px]">
                            <Clock className="w-3 h-3" /> लंबित
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{fd(tx.date)}</p>
                    </div>
                  </div>
                  <p className={`font-heading font-black text-lg ${isPending ? 'text-amber-600' : tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}{fc(tx.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
