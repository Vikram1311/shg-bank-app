import { useStore } from './store/useStore';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';
import MemberPage from './pages/MemberPage';
import './i18n';

function App() {
  const currentUserId = useStore(s => s.currentUserId);
  const getMember = useStore(s => s.getMember);

  if (!currentUserId) return <LoginPage />;

  const member = getMember(currentUserId);
  if (!member) return <LoginPage />;

  if (member.isAdmin) return <AdminPanel />;
  return <MemberPage />;
}

export default App;
