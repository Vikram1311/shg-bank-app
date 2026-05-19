import React from 'react';
import { useApp } from '../contexts/AppContext';
import { LogOut, Globe, Bell } from 'lucide-react';

export default function Header({ title, subtitle }) {
  const { user, logout, language, changeLanguage, t } = useApp();
  // Tamil is only available for members who have language='ta' or admin (for managing Ravi's account)
  const availableLangs = (user?.language === 'ta' || user?.isAdmin) ? ['hi', 'en', 'ta'] : ['hi', 'en'];

  return (
    <header className="sticky top-0 z-30 backdrop-blur-2xl bg-white/70 border-b-2 border-white/60" data-testid="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-xl">₹</span>
          </div>
          <div>
            <h1 className="font-heading text-lg sm:text-xl font-black leading-tight" data-testid="header-title">
              {title || t('appName')}
            </h1>
            <p className="text-xs text-muted-foreground font-semibold leading-tight">
              {subtitle || `${t('welcome')}, ${user?.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-muted/60 p-1 rounded-2xl">
            {availableLangs.map((lang) => (
              <button
                key={lang}
                data-testid={`header-lang-${lang}-btn`}
                onClick={() => changeLanguage(lang)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                  language === lang ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lang === 'hi' ? 'हिं' : lang === 'en' ? 'EN' : 'த'}
              </button>
            ))}
          </div>
          <button
            data-testid="mobile-lang-toggle"
            onClick={() => {
              const idx = availableLangs.indexOf(language);
              const next = availableLangs[(idx + 1) % availableLangs.length];
              changeLanguage(next);
            }}
            className="sm:hidden p-2 rounded-xl bg-muted hover:bg-muted/70 transition-all"
          >
            <Globe className="w-5 h-5 text-foreground" />
          </button>
          <button
            data-testid="logout-btn"
            onClick={logout}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-destructive/10 text-destructive font-bold text-sm hover:bg-destructive/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t('logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
