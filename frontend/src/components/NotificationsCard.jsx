import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/api';
import { Bell, BellRing, Check, AlertCircle, CheckCircle2, X, Coins } from 'lucide-react';

const TYPE_COLORS = {
  penalty: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertCircle, iconColor: 'text-red-600' },
  savings_approved: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: CheckCircle2, iconColor: 'text-emerald-600' },
  savings_rejected: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: X, iconColor: 'text-amber-600' },
  loan: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', icon: Coins, iconColor: 'text-violet-600' },
  general: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Bell, iconColor: 'text-blue-600' },
};

export default function NotificationsCard() {
  const { fd } = useApp();
  const [notifs, setNotifs] = useState([]);

  const load = async () => {
    try {
      const r = await api.get('/notifications');
      setNotifs(r.data);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      load();
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="card-3d p-6" data-testid="notifications-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-black text-xl flex items-center gap-2">
          {unreadCount > 0 ? <BellRing className="w-6 h-6 text-primary animate-pulse" /> : <Bell className="w-6 h-6" />}
          सूचनाएं
          {unreadCount > 0 && (
            <span className="pill bg-primary text-primary-foreground text-xs">{unreadCount} नई</span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs font-bold text-primary hover:underline" data-testid="mark-all-read-btn">
            सभी पढ़ें
          </button>
        )}
      </div>
      {notifs.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">कोई सूचना नहीं</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto" data-testid="notifications-list">
          {notifs.slice(0, 20).map((n) => {
            const cfg = TYPE_COLORS[n.type] || TYPE_COLORS.general;
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className={`p-3 rounded-2xl border-2 ${cfg.bg} ${cfg.border} ${!n.read ? 'shadow-md' : 'opacity-70'} cursor-pointer hover:opacity-100 transition-all`}
                onClick={() => !n.read && markRead(n.id)}
                data-testid={`notification-${n.id}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 ${cfg.iconColor} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${cfg.text}`}>{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fd(n.date)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
