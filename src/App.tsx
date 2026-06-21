import { useEffect } from 'react';
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
import { LicenseInterceptor } from './components/LicenseInterceptor';
import { ErrorBoundary } from './components/ErrorBoundary';

import { AutoBackupRunner } from './components/AutoBackupRunner';

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Set initial dir
    document.documentElement.dir = i18n.language.startsWith('ar') ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <ErrorBoundary>
      <AutoBackupRunner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="admin" element={<Admin />} />
            
            <Route element={<LicenseInterceptor><Outlet /></LicenseInterceptor>}>
              <Route index element={<Dashboard />} />
              <Route path="pos" element={<POS />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="settings" element={<Settings />} />
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


