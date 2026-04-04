import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDate, getMonthKey, calculateLoanDetails, calculatePenaltyDays } from '../utils/calculations';
import {
  IndianRupee, TrendingUp, Wallet, CreditCard, User, Lock, Camera,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Bell,
  FileText, Eye, XCircle, Banknote, ArrowUpCircle, Download, Share2
} from 'lucide-react';

type MemberTab = 'dashboard' | 'loans' | 'history' | 'profile';

export default function MemberPage() {
  const { t, i18n } = useTranslation();
  const store = useStore();
  const [activeTab, setActiveTab] = useState<MemberTab>('dashboard');
  const [showLoanCalc, setShowLoanCalc] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showLoanDetail, setShowLoanDetail] = useState<string | null>(null);
  const [showTotalAmount, setShowTotalAmount] = useState(false);

  // Loan calc
  const [loanAmount, setLoanAmount] = useState('');
  const [loanMonths, setLoanMonths] = useState('6');

  // Change pass
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');

  // Edit profile
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');

  // Photo
  const fileInputRef = useRef<HTMLInputElement>(null);

  const member = store.getMember(store.currentUserId!);
  if (!member) return null;

  const totalContrib = store.getMemberTotalContribution(member.id);
  const penaltyShare = store.getMemberPenaltyShare(member.id);
  const interestShare = store.getMemberInterestShare(member.id);
  const totalEarnings = penaltyShare + interestShare;
  const grandTotal = totalContrib + totalEarnings;
  const myLoans = store.getMemberLoans(member.id);
  const myContributions = store.getMemberContributions(member.id);
  const activeLoans = myLoans.filter(l => l.status === 'active' || l.status === 'pending');
  const canLoan = store.canApplyLoan(member.id);
  const defaulters = store.getDefaulterNames();
  const notifications = store.notifications.filter(n => !n.targetMemberId || n.targetMemberId === member.id);
  const pendingContrib = myContributions.filter(c => c.status === 'pending' && c.approvedByMember);

  const loanDetails = loanAmount ? calculateLoanDetails(Number(loanAmount), Number(loanMonths)) : null;

  const loanLimit = store.getMemberLoanLimit(member.id);

  const handleApplyLoan = () => {
    if (!loanAmount || Number(loanAmount) <= 0 || Number(loanAmount) > loanLimit) return;
    store.applyForLoan(member.id, Number(loanAmount), Number(loanMonths));
    setShowLoanCalc(false);
    setLoanAmount('');
    setLoanMonths('6');
  };

  const handleChangePass = () => {
    if (currentPass !== member.password) { setPassError('वर्तमान पासवर्ड गलत है'); return; }
    if (newPass.length < 4) { setPassError('पासवर्ड कम से कम 4 अंक का होना चाहिए'); return; }
    if (newPass !== confirmPass) { setPassError('पासवर्ड मेल नहीं खाता'); return; }
    store.changePassword(member.id, newPass);
    setPassError('');
    setShowChangePass(false);
    setCurrentPass(''); setNewPass(''); setConfirmPass('');
    alert('पासवर्ड बदला गया!');
  };

  const handleEditProfile = () => {
    if (editName) store.updateMember(member.id, { name: editName });
    if (editMobile) store.updateMember(member.id, { mobile: editMobile });
    setShowEditProfile(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => store.setProfilePhoto(member.id, reader.result as string);
    reader.readAsDataURL(file);
  };

  const btn3d = "relative overflow-hidden rounded-xl font-semibold text-white transition-all duration-200 active:scale-95 transform";
  const btnPrimary = `${btn3d} bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/30`;
  const btnSuccess = `${btn3d} bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/30`;
  const btnDanger = `${btn3d} bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/30`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 shadow-2xl">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-400 shadow-lg relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {member.profilePhoto ? (
                  <img src={member.profilePhoto} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl">
                    {member.name.charAt(0)}
                  </div>
                )}
                <Camera className="absolute bottom-0 right-0 w-4 h-4 bg-black/50 rounded-full p-0.5 text-white" />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              <div>
                <h1 className="text-white font-bold text-lg">{member.name}</h1>
                <p className="text-purple-200 text-sm">{member.mobile}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
              >
                <option value="hi">हिंदी</option>
                <option value="en">English</option>
                {member.name === 'RAVI ARUMUGAM' && <option value="ta">தமிழ்</option>}
              </select>
              <button onClick={() => store.logout()} className={btnDanger + " px-3 py-1.5 text-xs"}>
                <ArrowUpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<IndianRupee className="w-5 h-5" />} label={t('totalContribution')} value={totalContrib} color="from-emerald-500 to-green-600" />
              <StatCard icon={<AlertTriangle className="w-5 h-5" />} label={t('penaltyEarnings')} value={penaltyShare} color="from-red-500 to-rose-600" />
              <StatCard icon={<TrendingUp className="w-5 h-5" />} label={t('interestEarnings')} value={interestShare} color="from-blue-500 to-indigo-600" />
              <StatCard icon={<Wallet className="w-5 h-5" />} label={t('grandTotal')} value={grandTotal} color="from-amber-500 to-orange-600" />
            </div>

            {member.inactiveSince && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-orange-300 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">{t('inactive')} - {t('inactiveSince')}: {member.inactiveSince}</p>
                  <p className="text-xs mt-1">{t('loanLimitInactive')}: {formatCurrency(store.getMemberLoanLimit(member.id))}</p>
                </div>
              </div>
            )}

            {/* Total Earnings Card */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur rounded-2xl p-4 border border-purple-500/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-purple-300 text-sm">{t('totalEarnings')}</p>
                  <p className="text-white font-bold text-2xl">{formatCurrency(totalEarnings)}</p>
                </div>
                <button
                  onClick={() => setShowTotalAmount(!showTotalAmount)}
                  className="bg-white/10 px-3 py-2 rounded-xl text-yellow-400 text-sm font-semibold hover:bg-white/20"
                >
                  {showTotalAmount ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {t('showTotal')}
                </button>
              </div>
              {showTotalAmount && (
                <div className="mt-3 space-y-1 text-sm border-t border-white/10 pt-3">
                  <div className="flex justify-between text-gray-300">
                    <span>{t('totalContribution')}</span>
                    <span className="text-emerald-400">{formatCurrency(totalContrib)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>{t('penaltyEarnings')}</span>
                    <span className="text-red-400">{formatCurrency(penaltyShare)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>{t('interestEarnings')}</span>
                    <span className="text-blue-400">{formatCurrency(interestShare)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2">
                    <span>{t('grandTotal')}</span>
                    <span className="text-yellow-400">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-yellow-400" /> {t('paymentQR')}
              </h3>
              <div className="flex flex-col items-center bg-white rounded-2xl p-4">
                <QRCodeSVG value={`upi://pay?pa=${store.settings.upiId}&pn=SHG%20Bank`} size={160} />
                <a href={`upi://pay?pa=${store.settings.upiId}&pn=SHG%20Bank`} className="text-blue-600 font-bold mt-2 underline">{store.settings.upiId}</a>
                <p className="text-gray-500 text-xs">{t('scanToPay')}</p>
              </div>
            </div>

            {/* Defaulter List */}
            {defaulters.length > 0 && (
              <div className="bg-red-500/10 backdrop-blur rounded-2xl p-4 border border-red-500/20">
                <h3 className="text-red-300 font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {t('defaulterList')} ({defaulters.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {defaulters.map((name, i) => (
                    <span key={i} className="bg-red-500/20 text-red-200 px-3 py-1 rounded-full text-sm">{name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400" /> {t('notifications')} ({notifications.length})
                </h3>
                {notifications.slice(-5).map(n => (
                  <div key={n.id} className="bg-white/5 rounded-lg p-2 mb-2 text-sm text-gray-300">
                    {n.message}
                    <p className="text-gray-500 text-xs mt-1">{formatDate(n.date)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Contribution Deposit */}
            <button onClick={() => alert('कृपया UPI QR कोड से भुगतान करें। एडमिन द्वारा सत्यापन के बाद योगदान दिखाई देगा।')} className={btnPrimary + " w-full py-3 text-center flex items-center justify-center gap-2"}>
              <IndianRupee className="w-5 h-5" /> {t('contributionDeposit')}
            </button>
          </div>
        )}

        {/* Loans Tab */}
        {activeTab === 'loans' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">{t('loans')}</h2>
              <button onClick={() => setShowLoanCalc(true)} className={canLoan ? btnPrimary + " px-3 py-1.5 text-xs" : "bg-gray-600 text-gray-400 px-3 py-1.5 rounded-xl text-xs cursor-not-allowed"}>
                <CreditCard className="w-3 h-3 inline mr-1" /> {t('applyLoan')}
              </button>
            </div>

            {!canLoan && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-yellow-300 text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                {t('loanNotEligible')}
              </div>
            )}

            {myLoans.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>{t('noData')}</p>
              </div>
            ) : (
              myLoans.map(loan => (
                <div key={loan.id} className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className={`w-5 h-5 ${loan.status === 'active' ? 'text-emerald-400' : loan.status === 'pending' ? 'text-yellow-400' : 'text-blue-400'}`} />
                      <span className="text-white font-semibold">{formatCurrency(loan.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        loan.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                        loan.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                        loan.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{t(loan.status)}</span>
                      {loan.status === 'pending' && (
                        <button onClick={() => { if (confirm(t('confirmRecallLoan'))) store.recallLoan(loan.id); }} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-lg shadow-red-500/25 active:scale-95 transition-all duration-200">
                          {t('recallLoan')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-gray-400 text-xs">{t('emi')}</p>
                      <p className="text-white font-medium">{formatCurrency(loan.emiAmount)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-gray-400 text-xs">{t('totalInterest')}</p>
                      <p className="text-yellow-400 font-medium">{formatCurrency(loan.totalInterest)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-gray-400 text-xs">{t('remaining')}</p>
                      <p className="text-red-400 font-medium">{formatCurrency(loan.remainingAmount)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm text-gray-400">
                    <span>{loan.emiHistory.filter(e => e.status === 'paid').length}/{loan.months} EMI {t('paid')}</span>
                    <button onClick={() => setShowLoanDetail(loan.id)} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {t('view')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">{t('history')}</h2>
              <button
                onClick={() => {
                  const csv = store.exportMemberCSV(member.id);
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${member.name}_statement.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className={btnPrimary + " px-3 py-1.5 text-xs flex items-center gap-1"}
              >
                <Download className="w-3 h-3" /> {t('downloadStatement')}
              </button>
            </div>

            {/* Contributions History */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-400" /> {t('contributionHistory')}
              </h3>
              {myContributions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">{t('noData')}</p>
              ) : (
                <div className="space-y-2">
                  {myContributions.map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-white/5 rounded-lg p-2">
                      <div>
                        <p className="text-white text-sm">{c.month}</p>
                        {c.paidDate && <p className="text-gray-400 text-xs">{formatDate(c.paidDate)}</p>}
                        {c.penalty > 0 && <p className="text-red-400 text-xs">+{formatCurrency(c.penalty)} {t('penalty')}</p>}
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${c.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {t(c.status)}
                        </span>
                        <p className="text-white font-medium text-sm">{formatCurrency(c.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* EMI History */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" /> {t('loanHistory')} (EMI)
              </h3>
              {myLoans.flatMap(l => l.emiHistory.map(e => ({ ...e, loanAmount: l.amount, memberName: l.memberName }))).length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">{t('noData')}</p>
              ) : (
                <div className="space-y-2">
                  {myLoans.flatMap(l => l.emiHistory.map(e => ({ ...e, loanAmount: l.amount, memberName: l.memberName }))).map((emi, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 rounded-lg p-2">
                      <div>
                        <p className="text-white text-sm">EMI #{emi.emiNumber} ({formatCurrency(emi.loanAmount)})</p>
                        <p className="text-gray-400 text-xs">{emi.dueDate ? formatDate(emi.dueDate) : ''}</p>
                        {emi.penalty > 0 && <p className="text-red-400 text-xs">+{formatCurrency(emi.penalty)} {t('penalty')}</p>}
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${emi.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {t(emi.status)}
                        </span>
                        <p className="text-white font-medium text-sm">{formatCurrency(emi.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly ROI Breakdown */}
            {(() => {
              const sortedContribs = [...myContributions].sort((a, b) => a.month.localeCompare(b.month));
              if (sortedContribs.length === 0) return null;
              const monthlyData: Record<string, { contrib: number; interest: number }> = {};
              sortedContribs.forEach(c => {
                if (!monthlyData[c.month]) monthlyData[c.month] = { contrib: 0, interest: 0 };
                if (c.type === 'interest') monthlyData[c.month].interest += c.amount;
                else monthlyData[c.month].contrib += c.amount;
              });
              let balance = 0;
              const rows = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => {
                const opening = balance;
                const roi = opening > 0 ? Math.round((data.interest / opening) * 10000) / 100 : 0;
                balance = opening + data.contrib + data.interest;
                return { month, opening, contrib: data.contrib, interest: data.interest, roi, closing: balance };
              });
              return (
                <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-yellow-400" /> {t('monthlyROI')}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-white/10">
                          <th className="text-left py-1.5 px-1">{t('month')}</th>
                          <th className="text-right py-1.5 px-1">{t('contributions')}</th>
                          <th className="text-right py-1.5 px-1">{t('interest')}</th>
                          <th className="text-right py-1.5 px-1">ROI%</th>
                          <th className="text-right py-1.5 px-1">{t('total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-b border-white/5">
                            <td className="py-1.5 px-1 text-gray-300">{row.month}</td>
                            <td className="py-1.5 px-1 text-right text-emerald-400">{row.contrib > 0 ? formatCurrency(row.contrib) : '-'}</td>
                            <td className="py-1.5 px-1 text-right text-blue-400">{row.interest > 0 ? formatCurrency(row.interest) : '-'}</td>
                            <td className="py-1.5 px-1 text-right text-yellow-400">{row.roi > 0 ? `${row.roi}%` : '-'}</td>
                            <td className="py-1.5 px-1 text-right text-white font-medium">{formatCurrency(row.closing)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Profile Photo */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 text-center">
              <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-3 border-yellow-400 shadow-xl mb-3 relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {member.profilePhoto ? (
                  <img src={member.profilePhoto} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-3xl">
                    {member.name.charAt(0)}
                  </div>
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className={btnPrimary + " px-4 py-2 text-sm"}>
                <Camera className="w-4 h-4 inline mr-1" /> {t('profilePhoto')}
              </button>
            </div>

            {/* Member Info */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3">{t('profile')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-400">{t('name')}</span>
                  <span className="text-white font-medium">{member.name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-400">{t('mobile')}</span>
                  <span className="text-white font-medium">{member.mobile}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-400">{t('joiningDate')}</span>
                  <span className="text-white font-medium">{formatDate(member.joiningDate)}</span>
                </div>
              </div>
              <button onClick={() => { setEditName(member.name); setEditMobile(member.mobile); setShowEditProfile(true); }} className={btnPrimary + " w-full py-2.5 mt-4 text-sm"}>
                <User className="w-4 h-4 inline mr-1" /> {t('changeName')} / {t('changeMobile')}
              </button>
            </div>

            {/* Change Password */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4" /> {t('changePassword')}
              </h3>
              <div className="space-y-3">
                <input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} placeholder={t('currentPassword')} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t('newPassword')} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder={t('confirmPassword')} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                {passError && <p className="text-red-400 text-sm">{passError}</p>}
                <button onClick={handleChangePass} className={btnSuccess + " w-full py-2.5 text-sm"}>
                  {t('save')}
                </button>
              </div>
            </div>

            {/* Share App */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-2">📲 {t('shareApp')}</h3>
              <p className="text-gray-400 text-sm mb-4">{t('shareAppDesc')}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://github.com/Vikram1311/shg-bank-app/releases/latest/download/app-debug.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-all text-sm"
                >
                  <Download className="w-4 h-4" /> {t('downloadApk')}
                </a>
                <button
                  onClick={() => {
                    const apkUrl = 'https://github.com/Vikram1311/shg-bank-app/releases/latest/download/app-debug.apk';
                    const shareText = `${t('shareAppMessage')} ${apkUrl}`;
                    if (navigator.share) {
                      navigator.share({ title: t('appName'), text: shareText, url: apkUrl }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(apkUrl).then(() => alert(t('linkCopied'))).catch(() => {});
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all text-sm"
                >
                  <Share2 className="w-4 h-4" /> {t('shareApp')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 z-50">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          {([
            { key: 'dashboard' as MemberTab, icon: <TrendingUp className="w-5 h-5" />, label: t('summary') },
            { key: 'loans' as MemberTab, icon: <CreditCard className="w-5 h-5" />, label: t('loans') },
            { key: 'history' as MemberTab, icon: <FileText className="w-5 h-5" />, label: t('history') },
            { key: 'profile' as MemberTab, icon: <User className="w-5 h-5" />, label: t('profile') },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center py-1 px-3 rounded-lg transition-all ${activeTab === tab.key ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-300'}`}
            >
              {tab.icon}
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Loan Calculator Modal */}
      {showLoanCalc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowLoanCalc(false)}>
          <div className="bg-slate-800 rounded-t-3xl p-6 w-full max-w-lg border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">🔢 {t('loanCalculator')}</h3>
              <button onClick={() => setShowLoanCalc(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            {!canLoan && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-yellow-300 text-sm mb-4">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                {t('loanNotEligible')}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">{t('loanAmount')} (₹100 - ₹{loanLimit.toLocaleString()})</label>
                <input type="range" min="100" max={loanLimit} step="100" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className="w-full mt-2 accent-yellow-400" />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>₹100</span>
                  <span className="text-yellow-400 text-xl font-bold">₹{Number(loanAmount || 0).toLocaleString()}</span>
                  <span>₹{loanLimit.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm">{t('loanMonths')}</label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {[1, 2, 3, 4, 5, 6].map(m => (
                    <button
                      key={m}
                      onClick={() => setLoanMonths(String(m))}
                      className={`py-2 rounded-xl text-sm font-semibold transition-all ${loanMonths === String(m) ? 'bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-400/30 scale-105' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {loanDetails && (
                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-2xl p-4 border border-yellow-500/20">
                  <h4 className="text-white font-semibold mb-3">{t('emiBreakdown')}</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-gray-400 text-xs">{t('emiAmount')}</p>
                      <p className="text-white font-bold">{formatCurrency(loanDetails.emi)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-gray-400 text-xs">{t('totalInterest')}</p>
                      <p className="text-yellow-400 font-bold">{formatCurrency(loanDetails.totalInterest)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center col-span-2">
                      <p className="text-gray-400 text-xs">{t('totalPayable')}</p>
                      <p className="text-emerald-400 font-bold text-lg">{formatCurrency(loanDetails.totalPayable)}</p>
                    </div>
                  </div>

                  {/* EMI Table */}
                  <div className="space-y-1">
                    {loanDetails.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between text-xs bg-white/5 rounded-lg p-1.5">
                        <span className="text-gray-400">EMI #{b.emiNumber}</span>
                        <span className="text-white">{formatCurrency(b.amount)}</span>
                        <span className="text-blue-400">ब्याज: {formatCurrency(b.interest)}</span>
                        <span className="text-gray-400">शेष: {formatCurrency(b.remaining)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-400 space-y-1">
                <p>📌 {t('interestInfo')}</p>
                <p>📌 {t('lateFeeInfo')}</p>
                <p>📌 {member.inactiveSince ? `${t('loanLimitInactive')}: ${formatCurrency(loanLimit)}` : t('loanLimitInfo')}</p>
              </div>

              <button
                onClick={handleApplyLoan}
                disabled={!canLoan || !loanAmount}
                className={`${canLoan && loanAmount ? btnSuccess : 'bg-gray-600 text-gray-400 cursor-not-allowed'} w-full py-3 text-center`}
              >
                <CheckCircle className="w-5 h-5 inline mr-1" /> {t('applyLoan')} - {formatCurrency(Number(loanAmount || 0))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMI Detail Modal */}
      {showLoanDetail && (
        (() => {
          const loan = myLoans.find(l => l.id === showLoanDetail);
          if (!loan) return null;
          return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowLoanDetail(null)}>
              <div className="bg-slate-800 rounded-t-3xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-bold text-lg">{t('loanDetails')}</h3>
                  <button onClick={() => setShowLoanDetail(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">{t('loanAmount')}</p>
                    <p className="text-white font-bold">{formatCurrency(loan.amount)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">{t('emiAmount')}</p>
                    <p className="text-white font-bold">{formatCurrency(loan.emiAmount)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">{t('totalInterest')}</p>
                    <p className="text-yellow-400 font-bold">{formatCurrency(loan.totalInterest)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">{t('remaining')}</p>
                    <p className="text-red-400 font-bold">{formatCurrency(loan.remainingAmount)}</p>
                  </div>
                </div>
                <p className="text-gray-400 text-xs mb-2">{t('openingDate')}: {formatDate(loan.openingDate)} → {t('closingDate')}: {loan.closingDate ? formatDate(loan.closingDate) : t('currentRunningLoan')}{loan.foreclosureDate ? ` (${t('foreclosureDate')}: ${formatDate(loan.foreclosureDate)})` : ''}</p>
                <div className="space-y-2">
                  {loan.emiHistory.map(emi => (
                    <div key={emi.id} className={`rounded-xl p-3 border ${emi.status === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">EMI #{emi.emiNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${emi.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {t(emi.status)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-400">{formatCurrency(emi.amount)} (ब्याज: {formatCurrency(emi.interestComponent)})</span>
                      </div>
                      <div className="flex justify-between text-xs mt-1 text-gray-400">
                        <span>{t('dueDate')}: {formatDate(emi.dueDate)}</span>
                        {emi.status === 'paid' && emi.paidDate && <span>{t('paidDate')}: {formatDate(emi.paidDate)}</span>}
                      </div>
                      {emi.penalty > 0 && <p className="text-red-400 text-xs mt-1">+ {formatCurrency(emi.penalty)} {t('penalty')}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEditProfile(false)}>
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">{t('edit')} {t('profile')}</h3>
              <button onClick={() => setShowEditProfile(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">{t('name')}</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-gray-400 text-sm">{t('mobile')}</label>
                <input value={editMobile} onChange={(e) => setEditMobile(e.target.value)} maxLength={10} className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleEditProfile} className={btnSuccess + " flex-1 py-3"}>{t('save')}</button>
                <button onClick={() => setShowEditProfile(false)} className={btnDanger + " px-6 py-3"}>{t('cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl p-3 border border-white/10 hover:border-white/20 transition-all hover:scale-[1.02]">
      <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-white mb-2 shadow-lg`}>
        {icon}
      </div>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-white font-bold text-lg">{formatCurrency(value)}</p>
    </div>
  );
}
