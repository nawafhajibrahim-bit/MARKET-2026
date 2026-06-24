import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShoppingCart, Package, Settings as SettingsIcon, HandCoins, FileText, LogOut, User, Store, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Layout = () => {
  const { t, i18n } = useTranslation();
  const { currentUser, currentBranch, availableBranches, logout, isAdmin, switchBranch } = useAuth();
  const location = useLocation();

  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('selected_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'eye-comfort');
    if (theme !== 'light') {
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  };

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('selected_theme', newTheme);
  };

  const handleBranchChange = async (branchId: string) => {
    if (branchId) {
      await switchBranch(branchId);
    }
  };

  // Filter nav items based on role
  const allNavItems = [
    { path: '/', label: t('dashboard'), icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier'] },
    { path: '/pos', label: t('pos'), icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
    { path: '/inventory', label: t('inventory'), icon: Package, roles: ['admin', 'manager'] },
    { path: '/sales-history', label: t('sales_history'), icon: FileText, roles: ['admin', 'manager', 'cashier'] },
    { path: '/debts', label: t('debts_nav'), icon: HandCoins, roles: ['admin', 'manager', 'cashier'] },
    { path: '/settings', label: t('settings'), icon: SettingsIcon, roles: ['admin', 'manager'] },
    { path: '/admin', label: t('subscriber_mgmt'), icon: ShieldCheck, roles: ['admin'] },
  ];

  const userRole = currentUser?.role || 'cashier';
  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <header className="sticky top-0 z-50 flex justify-between items-center bg-white/5 backdrop-blur-md p-4 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-[var(--color-primary)]">
            {t('app_name')}
          </h1>

          {/* Branch selector (if multi-branch) */}
          {availableBranches.length > 1 && isAdmin && (
            <select
              value={currentBranch?.branch_id || ''}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="hidden lg:block p-1.5 text-xs rounded-lg bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/10 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer"
            >
              {availableBranches.map(b => (
                <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
              ))}
            </select>
          )}

          {currentBranch && availableBranches.length <= 1 && (
            <span className="hidden lg:flex items-center gap-1 text-xs text-gray-500">
              <Store size={12} />
              {currentBranch.name}
            </span>
          )}

          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-purple-500/20'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* User info */}
          {currentUser && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <User size={14} />
                <span className="font-medium">{currentUser.display_name || currentUser.username}</span>
              </div>
              {isAdmin && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-bold">
                  <ShieldCheck size={10} />
                  Admin
                </span>
              )}
            </div>
          )}

          <select
            onChange={(e) => changeLanguage(e.target.value)}
            value={i18n.language.split('-')[0]}
            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/10 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer text-sm"
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
          <select
            onChange={(e) => changeTheme(e.target.value)}
            value={theme}
            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/10 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer text-sm"
          >
            <option value="light">{t('light_mode')}</option>
            <option value="dark">{t('dark_mode')}</option>
            <option value="eye-comfort">{t('eye_comfort_mode')}</option>
          </select>
          <button
            onClick={logout}
            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-red-500/10 hover:text-red-500 transition-all cursor-pointer"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      
      {/* Mobile nav for small screens */}
      <div className="md:hidden flex justify-around p-3 border-b border-black/5 dark:border-white/5 bg-white/5 backdrop-blur-md">
        {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs ${
                  isActive ? 'text-[var(--color-primary)]' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </div>

      <main className="p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};
