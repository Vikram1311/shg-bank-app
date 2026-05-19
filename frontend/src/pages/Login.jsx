import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { toast } from 'sonner';
import { Lock, Phone, Sparkles, Wallet } from 'lucide-react';

export default function Login() {
  const { login, language, changeLanguage, t } = useApp();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(mobile.trim(), password.trim());
      toast.success(t('welcome'));
    } catch (err) {
      toast.error(t('invalidCreds'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" data-testid="login-page">
      {/* Floating colorful blobs */}
      <div className="blob bg-pink-400" style={{ width: '320px', height: '320px', top: '-80px', left: '-80px' }} />
      <div className="blob bg-amber-400" style={{ width: '380px', height: '380px', top: '40%', right: '-100px' }} />
      <div className="blob bg-violet-400" style={{ width: '300px', height: '300px', bottom: '-80px', left: '20%' }} />
      <div className="blob bg-emerald-300" style={{ width: '260px', height: '260px', top: '20%', left: '40%', opacity: 0.3 }} />

      {/* Language switcher - Tamil hidden on login (only logged-in Ravi/admin sees it) */}
      <div className="absolute top-6 right-6 z-10 flex gap-2">
        {['hi', 'en'].map((lang) => (
          <button
            key={lang}
            data-testid={`lang-${lang}-btn`}
            onClick={() => changeLanguage(lang)}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
              language === lang
                ? 'bg-primary text-primary-foreground shadow-[0_3px_0_0_#be123c]'
                : 'bg-white/80 text-foreground'
            }`}
          >
            {lang === 'hi' ? 'हिं' : 'EN'}
          </button>
        ))}
      </div>

      <div className="card-3d max-w-md w-full p-8 relative z-10 animate-scale-in" data-testid="login-card">
        {/* Logo/Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative float-anim">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-xl">
              <Wallet className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
            <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1.5 shadow-lg">
              <Sparkles className="w-4 h-4 text-yellow-900" strokeWidth={3} />
            </div>
          </div>
          <h1 className="font-heading text-4xl font-black mt-5 text-foreground" data-testid="app-title">
            {t('appName')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-semibold">{t('appSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
          <div>
            <label className="text-sm font-bold text-foreground/80 mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              {t('mobile')}
            </label>
            <input
              type="tel"
              className="input-3d"
              placeholder="9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              maxLength={10}
              required
              data-testid="mobile-input"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-foreground/80 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              {t('password')}
            </label>
            <input
              type="password"
              className="input-3d"
              placeholder="••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="password-input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-3d-primary w-full text-lg" data-testid="login-submit-btn">
            {loading ? t('loading') : t('loginBtn')} →
          </button>
        </form>

        <div className="mt-6 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
          <p className="text-xs text-amber-900 font-semibold leading-relaxed">
            💡 {language === 'hi' ? 'डिफ़ॉल्ट पासवर्ड: मोबाइल नंबर के अंतिम 4 अंक' :
                  language === 'ta' ? 'இயல்புநிலை கடவுச்சொல்: மொபைல் எண்ணின் கடைசி 4 இலக்கங்கள்' :
                  'Default password: last 4 digits of mobile number'}
          </p>
        </div>
      </div>
    </div>
  );
}
