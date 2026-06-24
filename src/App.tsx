import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Debts } from './pages/Debts';
import { SalesHistory } from './pages/SalesHistory';
import { LoginScreen } from './pages/Login';
import { LicenseInterceptor } from './components/LicenseInterceptor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { DevReset } from './pages/DevReset';
import { formatLegacyHash } from './services/passwordService';
import { useAuth } from './contexts/AuthContext';

import { AutoBackupRunner } from './components/AutoBackupRunner';

// Route guard: only authenticated users
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, currentUser } = useAuth();
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  useEffect(() => {
    const checkDefaultPassword = async () => {
      if (currentUser) {
        try {
          const defaultHash = await formatLegacyHash('admin');
          if (currentUser.role === 'admin' && currentUser.password_hash === defaultHash) {
            setNeedsPasswordChange(true);
          } else {
            setNeedsPasswordChange(false);
          }
        } catch (err) {
          console.error('Failed to check default password:', err);
        }
      }
    };
    checkDefaultPassword();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  return (
    <>
      {needsPasswordChange && (
        <ForcePasswordChange onDone={() => setNeedsPasswordChange(false)} />
      )}
      {children}
    </>
  );
}

// Route guard: only admin/manager
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isManager, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }
  if (!isManager) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language.startsWith('ar') ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <ErrorBoundary>
      <AutoBackupRunner />
      <BrowserRouter>
        <Routes>
          {/* Hidden developer recovery route — no auth, no license check */}
          <Route path="/dev-reset" element={<DevReset />} />

          {/* Standalone Admin route for the program owner - only requires ADMIN_SECRET */}
          <Route path="/admin" element={<Admin />} />

          <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
            {/* All main routes wrapped by license interceptor */}
            <Route element={<LicenseInterceptor><Outlet /></LicenseInterceptor>}>
              <Route index element={<Dashboard />} />
              <Route path="pos" element={<POS />} />
              <Route path="inventory" element={<AdminGuard><Inventory /></AdminGuard>} />
              <Route path="settings" element={<AdminGuard><Settings /></AdminGuard>} />
              <Route path="debts" element={<Debts />} />
              <Route path="sales-history" element={<SalesHistory />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
