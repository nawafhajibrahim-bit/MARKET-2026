import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShoppingCart, Package, Settings as SettingsIcon, HandCoins, FileText } from 'lucide-react';

export const Layout = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('selected_theme') || 'light';
  });

  // Apply theme on mount and when theme changes
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

  const navItems = [
    { path: '/', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/pos', label: t('pos'), icon: ShoppingCart },
    { path: '/inventory', label: t('inventory'), icon: Package },
    { path: '/sales-history', label: t('sales_history'), icon: FileText },
    { path: '/debts', label: t('debts_nav'), icon: HandCoins },
    { path: '/settings', label: t('settings'), icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <header className="sticky top-0 z-50 flex justify-between items-center bg-white/5 backdrop-blur-md p-4 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">
            {t('app_name')}
          </h1>
          <nav className="hidden md:flex gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-purple-500/20'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex gap-4">
          <select
            onChange={(e) => changeLanguage(e.target.value)}
            value={i18n.language.split('-')[0]}
            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/10 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer"
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
          <select
            onChange={(e) => changeTheme(e.target.value)}
            value={theme}
            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/10 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer"
          >
            <option value="light">{t('light_mode')}</option>
            <option value="dark">{t('dark_mode')}</option>
            <option value="eye-comfort">{t('eye_comfort_mode')}</option>
          </select>
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
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-sm ${
                  isActive ? 'text-[var(--color-primary)]' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <Icon size={20} />
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
