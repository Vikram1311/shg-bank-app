import { useStore } from './store/useStore';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';
import MemberPage from './pages/MemberPage';
import './i18n';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isCloudSyncEnabled } from './lib/supabase';
import { pullFromCloud, mergeCloudData } from './lib/cloudSync';

function App() {
  const { t } = useTranslation();
  const currentUserId = useStore(s => s.currentUserId);
  const getMember = useStore(s => s.getMember);
  const [syncing, setSyncing] = useState(() => isCloudSyncEnabled());

  useEffect(() => {
    if (!isCloudSyncEnabled()) return;

    pullFromCloud().then(cloudData => {
      if (cloudData) {
        const localMembers = useStore.getState().members;
        const merged = mergeCloudData(localMembers, cloudData);
        useStore.setState(merged);
      }
    }).finally(() => {
      setSyncing(false);
    });
  }, []);

  if (syncing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">{t('syncingData')}</p>
          <p className="text-gray-400 text-sm mt-1">{t('loadingFromCloud')}</p>
        </div>
      </div>
    );
  }

  if (!currentUserId) return <LoginPage />;

  const member = getMember(currentUserId);
  if (!member) return <LoginPage />;

  if (member.isAdmin) return <AdminPanel />;
  return <MemberPage />;
}

export default App;
