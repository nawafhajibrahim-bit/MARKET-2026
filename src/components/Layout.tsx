import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShoppingCart, Package, Settings as SettingsIcon, HandCoins, FileText, LogOut, User, Store, ShieldCheck, Crown, X, Truck, Lightbulb, MessageCircle, Globe } from 'lucide-react';
import { WelcomeModal } from './WelcomeModal';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../database/Provider';

export const Layout = () => {
  const { t, i18n } = useTranslation();
  const { currentUser, currentBranch, availableBranches, logout, isAdmin, switchBranch } = useAuth();
  const location = useLocation();
  const db = useDb();
  const [sysConfig, setSysConfig] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [reqPhone, setReqPhone] = useState('');
  const [reqDuration, setReqDuration] = useState(3);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (db) {
      db.system_config.findOne('config').$.subscribe(doc => {
        if (doc) setSysConfig(doc.toJSON());
      });
    }

    const hasSeenWelcome = localStorage.getItem('has_seen_welcome_v3');
    if (!hasSeenWelcome) {
      setShowWelcomeModal(true);
    }
  }, [db]);

  const isTrial = !sysConfig?.license_key || sysConfig?.license_key === '';

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

  const handleRequestExtension = async () => {
    if (!sysConfig) return;
    setReqLoading(true);
    setReqSuccess(null);
    try {
      const res = await fetch('/api/license-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          hardware_fingerprint: sysConfig.hardware_fingerprint || 'unknown',
          merchant_name: localStorage.getItem('receipt_shop_name') || 'عميل (بدون اسم)',
          phone: reqPhone,
          duration_months: reqDuration,
          current_license_key: sysConfig.license_key || 'trial'
        })
      });
      if (res.ok) {
        setReqSuccess(i18n.language.startsWith('ar') ? 'تم إرسال الطلب بنجاح!' : 'Request sent successfully!');
        
        const shopName = localStorage.getItem('receipt_shop_name') || 'عميل';
        const msg = i18n.language.startsWith('ar') 
          ? `مرحباً، أود طلب تمديد/ترقية اشتراكي في نظام إدارة المبيعات لمدة ${reqDuration} أشهر.\n\nالاسم: ${shopName}\nالهاتف: ${reqPhone}\nالمعرف: ${sysConfig.hardware_fingerprint || 'غير متوفر'}\nالترخيص الحالي: ${sysConfig.license_key || 'فترة تجريبية'}`
          : `Hello, I would like to request a subscription extension for ${reqDuration} months.\n\nName: ${shopName}\nPhone: ${reqPhone}\nID: ${sysConfig.hardware_fingerprint || 'N/A'}\nCurrent License: ${sysConfig.license_key || 'Trial'}`;
        
        const encodedMsg = encodeURIComponent(msg);
        window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
      } else {
        alert(i18n.language.startsWith('ar') ? 'حدث خطأ أثناء إرسال الطلب' : 'Failed to send request');
      }
    } catch (err) {
      console.error(err);
      alert(i18n.language.startsWith('ar') ? 'خطأ في الاتصال' : 'Network error');
    } finally {
      setReqLoading(false);
    }
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
    { path: '/purchases', label: i18n.language.startsWith('ar') ? 'المشتريات' : 'Purchases', icon: Truck, roles: ['admin', 'manager'] },
    { path: '/sales-history', label: t('sales_history'), icon: FileText, roles: ['admin', 'manager', 'cashier'] },
    { path: '/debts', label: t('debts_nav'), icon: HandCoins, roles: ['admin', 'manager', 'cashier'] },
    { path: '/settings', label: t('settings'), icon: SettingsIcon, roles: ['admin', 'manager'] },
    { path: '/admin', label: t('subscriber_mgmt'), icon: ShieldCheck, roles: ['developer_only'] },
  ];

  const userRole = currentUser?.role || 'cashier';
  const isDeveloperUser = currentUser?.username === 'developer';
  const navItems = allNavItems.filter(item => {
    if (item.path === '/admin') return isDeveloperUser;
    return item.roles.includes(userRole);
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <header className="sticky top-0 z-50 flex flex-wrap justify-between items-center bg-white/5 backdrop-blur-md p-4 border-b border-black/5 dark:border-white/5 gap-4">
        <div className="flex flex-wrap items-center gap-4">
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
            <span className="hidden lg:flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
              <Store size={12} />
              {currentBranch.name}
            </span>
          )}

          <nav className="hidden md:flex flex-wrap gap-1">
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

        <div className="flex flex-wrap items-center gap-3">
          {isTrial && isAdmin && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-bold text-sm shadow-md transition-all cursor-pointer animate-pulse"
            >
              <Crown size={16} />
              <span className="hidden sm:inline">{t('premium_subscription') || (i18n.language.startsWith('ar') ? 'الاشتراك المدفوع' : 'Premium Plan')}</span>
            </button>
          )}

          <button
            onClick={() => setShowWelcomeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg font-bold text-sm transition-all cursor-pointer border border-blue-500/20"
            title={i18n.language.startsWith('ar') ? 'التحديثات والمقترحات' : 'Updates & Feedback'}
          >
            <Lightbulb size={16} className="text-yellow-500" />
            <span className="hidden sm:inline">{i18n.language.startsWith('ar') ? 'المقترحات' : 'Feedback'}</span>
          </button>

          <a
            href="https://wa.me/96407510171376"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded-lg font-bold text-sm transition-all cursor-pointer border border-green-500/20"
            title={i18n.language.startsWith('ar') ? 'تواصل معنا عبر واتساب' : 'Contact via WhatsApp'}
          >
            <MessageCircle size={16} className="text-green-500" />
            <span className="hidden sm:inline">{i18n.language.startsWith('ar') ? 'الدعم' : 'Support'}</span>
          </a>

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

          <div 
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-[var(--color-primary)] transition-all"
            title={i18n.language.startsWith('ar') ? 'تغيير اللغة / Change Language' : 'Change Language / تغيير اللغة'}
          >
            <Globe size={18} className="text-[var(--color-primary)] shrink-0" />
            <select
              onChange={(e) => changeLanguage(e.target.value)}
              value={i18n.language.split('-')[0]}
              aria-label="Language / اللغة"
              className="bg-transparent border-none outline-none cursor-pointer text-sm font-semibold focus:ring-0 pr-1 pl-1 text-[var(--text)]"
            >
              <option value="ar" className="bg-white dark:bg-[#1f2028] text-gray-900 dark:text-white">العربية (Arabic)</option>
              <option value="en" className="bg-white dark:bg-[#1f2028] text-gray-900 dark:text-white">English (الإنجليزية)</option>
            </select>
          </div>
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

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2028] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-orange-500/10">
              <div className="flex items-center gap-3">
                <Crown className="text-orange-500" size={28} />
                <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {i18n.language.startsWith('ar') ? 'ترقية للنسخة المدفوعة' : 'Upgrade to Premium'}
                </h3>
              </div>
              <button onClick={() => setShowUpgradeModal(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {i18n.language.startsWith('ar') 
                  ? 'احصل على كافة الميزات اللامحدودة وأمان النسخ الاحتياطي السحابي باشتراكك معنا.' 
                  : 'Get unlimited access and cloud backup by upgrading your plan.'}
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">{i18n.language.startsWith('ar') ? 'المدة المطلوبة' : 'Duration'}</label>
                <select 
                  value={reqDuration}
                  onChange={(e) => setReqDuration(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer transition-all font-medium"
                >
                  <option value={1}>{i18n.language.startsWith('ar') ? 'شهر واحد' : '1 Month'}</option>
                  <option value={3}>{i18n.language.startsWith('ar') ? '3 أشهر' : '3 Months'}</option>
                  <option value={6}>{i18n.language.startsWith('ar') ? '6 أشهر' : '6 Months'}</option>
                  <option value={12}>{i18n.language.startsWith('ar') ? 'سنة كاملة' : '1 Year'}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{i18n.language.startsWith('ar') ? 'رقم الهاتف للتواصل' : 'Phone Number'}</label>
                <input 
                  type="tel"
                  required
                  value={reqPhone}
                  onChange={(e) => setReqPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-medium"
                />
              </div>

              {reqSuccess && (
                <div className="p-3 bg-green-500/10 text-green-600 rounded-xl text-sm font-bold text-center">
                  {reqSuccess}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-black/10 dark:border-white/10 flex justify-end gap-3 bg-black/5 dark:bg-white/5">
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                {i18n.language.startsWith('ar') ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={handleRequestExtension}
                disabled={reqLoading || !reqPhone}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center min-w-[120px]"
              >
                {reqLoading ? '...' : (i18n.language.startsWith('ar') ? 'إرسال الطلب' : 'Send Request')}
              </button>
            </div>
          </div>
        </div>
      )}

      <WelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
    </div>
  );
};
