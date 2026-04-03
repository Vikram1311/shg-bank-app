import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from 'react-i18next';
import { Lock, Phone, Eye, EyeOff, Banknote } from 'lucide-react';

export default function LoginPage() {
  const { t } = useTranslation();
  const login = useStore(s => s.login);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState<'login'>('login');

  const handleLogin = () => {
    if (!mobile || !password) {
      setError('कृपया मोबाइल नंबर और पासवर्ड दर्ज करें');
      return;
    }
    const member = login(mobile, password);
    if (!member) {
      setError('गलत मोबाइल नंबर या पासवर्ड');
      return;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl shadow-2xl shadow-orange-500/30 mb-4 transform hover:rotate-6 transition-transform">
            <Banknote className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">SHG BANK</h1>
          <p className="text-purple-200 mt-2 text-lg">स्वयं सहायता समूह बैंक</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          {page === 'login' && (
            <>
              <div className="mb-6">
                <label className="block text-purple-200 text-sm font-medium mb-2">📱 {t('mobile')}</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="मोबाइल नंबर दर्ज करें"
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-purple-200 text-sm font-medium mb-2">🔒 {t('password')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="पासवर्ड दर्ज करें"
                    className="w-full pl-12 pr-12 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm text-center animate-pulse">
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-lg rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 transform"
                style={{ boxShadow: '0 8px 20px -4px rgba(251, 146, 60, 0.5), 0 4px 6px -2px rgba(251, 146, 60, 0.3), inset 0 2px 0 rgba(255,255,255,0.3)' }}
              >
                {t('loginBtn')} 🚀
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-purple-300/50 text-xs mt-6">
          SHG Bank © 2025 • Secure Self Help Group Banking
        </p>
      </div>
    </div>
  );
}
