import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LicenseInterceptor } from './components/LicenseInterceptor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { useAuth } from './contexts/AuthContext';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION } from './utils/version';
import { ArrowUpCircle, X } from 'lucide-react';
import { AutoBackupRunner } from './components/AutoBackupRunner';

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const POS = lazy(() => import('./pages/POS').then(m => ({ default: m.POS })));
const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Debts = lazy(() => import('./pages/Debts').then(m => ({ default: m.Debts })));
const Purchases = lazy(() => import('./pages/Purchases').then(m => ({ default: m.Purchases })));
const SalesHistory = lazy(() => import('./pages/SalesHistory').then(m => ({ default: m.SalesHistory })));
const LoginScreen = lazy(() => import('./pages/Login').then(m => ({ default: m.LoginScreen })));
const DevReset = lazy(() => import('./pages/DevReset').then(m => ({ default: m.DevReset })));

// Route guard: only authenticated users
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, currentUser } = useAuth();
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  useEffect(() => {
    // Disabled checking for default password to allow trial users 
    // to use the application with default credentials.
    setNeedsPasswordChange(false);
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

  // PWA update setup
  const { updateServiceWorker } = useRegisterSW();

  const [showBanner, setShowBanner] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    document.documentElement.dir = i18n.language.startsWith('ar') ? 'rtl' : 'ltr';
  }, [i18n.language]);

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (!response.ok) return;
        const data = await response.json();
        
        const compareVersions = (v1: string, v2: string) => {
          const parts1 = v1.split('.').map(Number);
          const parts2 = v2.split('.').map(Number);
          for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
          }
          return 0;
        };

        if (compareVersions(data.version, APP_VERSION) > 0) {
          // 1) Developer control: check if developer disabled notifications explicitly
          if (data.notify_users === false) return;
          
          // 2) Developer control: check if there is a delayed notification date
          if (data.notify_after && new Date() < new Date(data.notify_after)) return;

          // 3) User control: check if user dismissed this specific version recently (e.g. 24h)
          const dismissedData = localStorage.getItem('dismissed_update');
          if (dismissedData) {
            try {
              const { version, time } = JSON.parse(dismissedData);
              if (version === data.version && Date.now() - time < 24 * 60 * 60 * 1000) {
                return; // skip showing banner for 24 hours
              }
            } catch {}
          }

          setUpdateInfo(data);
          setShowBanner(true);
          
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              await reg.update().catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('Silent update check failed:', err);
      }
    };

    const timer = setTimeout(checkUpdates, 5000);
    const interval = setInterval(checkUpdates, 12 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const LazyFallback = (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
    </div>
  );

  return (
    <ErrorBoundary>
      <AutoBackupRunner />
      <BrowserRouter>
        <Suspense fallback={LazyFallback}>
          <Routes>
            {/* Hidden developer recovery route — no auth, no license check */}
            {import.meta.env.DEV && <Route path="/dev-reset" element={<DevReset />} />}

            {/* Standalone Admin route for the program owner - only requires ADMIN_SECRET */}
            <Route path="/owner-portal" element={<Admin />} />

            <Route path="/" element={<LicenseInterceptor><AuthGuard><Layout /></AuthGuard></LicenseInterceptor>}>
              <Route index element={<Dashboard />} />
              <Route path="pos" element={<POS />} />
              <Route path="inventory" element={<AdminGuard><Inventory /></AdminGuard>} />
              <Route path="purchases" element={<AdminGuard><Purchases /></AdminGuard>} />
              <Route path="settings" element={<AdminGuard><Settings /></AdminGuard>} />
              <Route path="debts" element={<Debts />} />
              <Route path="sales-history" element={<SalesHistory />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>

      {/* Floating Notification Banner */}
      {showBanner && updateInfo && (
        <div 
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-md bg-[var(--color-primary)] text-white p-4 rounded-xl shadow-2xl z-[150] flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300 select-none" 
          dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center gap-3 cursor-pointer animate-in fade-in duration-300" onClick={() => setShowModal(true)}>
            <ArrowUpCircle className="shrink-0 animate-bounce" size={24} />
            <div>
              <p className="font-bold text-sm">
                {i18n.language.startsWith('ar') ? 'يتوفر تحديث جديد للبرنامج!' : 'A new update is available!'}
              </p>
              <p className="text-xs text-white/80 mt-0.5">
                {i18n.language.startsWith('ar') 
                  ? `الإصدار ${updateInfo.version} جاهز للتحميل. اضغط للتفاصيل.` 
                  : `Version ${updateInfo.version} is ready. Click for details.`
                }
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setShowBanner(false);
              localStorage.setItem('dismissed_update', JSON.stringify({ version: updateInfo.version, time: Date.now() }));
            }}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Update Changelog Modal */}
      {showModal && updateInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-lg shadow-2xl border border-black/10 dark:border-white/10 p-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-black/5 dark:border-white/5">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[var(--color-primary)]">
                <ArrowUpCircle size={22} />
                {i18n.language.startsWith('ar') ? 'تحديث البرنامج المتوفر' : 'Available Software Update'}
              </h3>
              <button 
                onClick={() => {
                  setShowModal(false);
                  localStorage.setItem('dismissed_update', JSON.stringify({ version: updateInfo.version, time: Date.now() }));
                }}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <span className="text-xs text-gray-400 block mb-1">
                  {i18n.language.startsWith('ar') ? 'تفاصيل الإصدار الجديد' : 'New Release Details'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold font-mono text-[var(--color-primary)]">{updateInfo.version}</span>
                  <span className="text-xs text-gray-500 font-mono">({updateInfo.release_date})</span>
                </div>
              </div>

              <div className="border-t border-black/5 dark:border-white/5 pt-3">
                <h4 className="font-semibold text-sm mb-2">{i18n.language.startsWith('ar') ? 'ما الجديد في هذا التحديث:' : 'What\'s new in this release:'}</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-600 dark:text-gray-300 font-sans" dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}>
                  {(i18n.language.startsWith('ar') ? updateInfo.changelog_ar : updateInfo.changelog_en).map((line: string, idx: number) => (
                    <li key={idx} className="leading-relaxed">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-black/5 dark:border-white/5">
              <button 
                type="button"
                onClick={() => {
                  setShowModal(false);
                  localStorage.setItem('dismissed_update', JSON.stringify({ version: updateInfo.version, time: Date.now() }));
                }}
                className="px-5 py-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer text-sm"
              >
                {i18n.language.startsWith('ar') ? 'لاحقاً' : 'Later'}
              </button>
              <button 
                type="button"
                onClick={async () => {
                  setShowModal(false);
                  setShowBanner(false);
                  try {
                    await updateServiceWorker(true);
                    setTimeout(() => {
                      window.location.reload();
                    }, 1500);
                  } catch (e) {
                    console.error(e);
                    window.location.reload();
                  }
                }}
                className="px-5 py-2 rounded-lg bg-[var(--color-primary)] text-white hover:brightness-110 active:scale-95 transition-all font-semibold cursor-pointer text-sm"
              >
                {i18n.language.startsWith('ar') ? 'تحديث الآن' : 'Update Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;
