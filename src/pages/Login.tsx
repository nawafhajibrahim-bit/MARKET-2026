import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, User, Lock, Store, Zap, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const { login, availableBranches, switchBranch } = useAuth();
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Automatically select the first branch by default
  React.useEffect(() => {
    if (availableBranches.length > 0 && !selectedBranch) {
      setSelectedBranch(availableBranches[0].branch_id);
    }
  }, [availableBranches, selectedBranch]);

  const handleQuickLogin = async () => {
    setError('');
    setLoading(true);
    const result = await login('admin', 'admin');
    if (result.success && selectedBranch) {
      await switchBranch(selectedBranch);
    }
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  const handleAdvancedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError(isAr ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Please enter username and password');
      return;
    }
    setError('');
    setLoading(true);

    const result = await login(username, password);
    if (result.success && selectedBranch) {
      await switchBranch(selectedBranch);
    }
    if (!result.success) {
      setError(result.error || 'Login failed');
    }

    setLoading(false);
  };

  const handleRequestSubscription = () => {
    const msg = isAr 
      ? `مرحباً، أود تجربة / الاشتراك في نظام إدارة المبيعات الذكي.`
      : `Hello, I would like to try/subscribe to the Smart POS System.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--text)] p-4 relative">
      <div className="w-full max-w-md bg-white dark:bg-[#1f2028] rounded-2xl shadow-xl border border-black/5 dark:border-white/5 p-8 space-y-6 z-10">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
            <LogIn size={32} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="text-2xl font-bold">{t('app_name')}</h1>
          <p className="text-sm text-gray-500 mb-4">{t('welcome')}</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm text-center font-bold">
            {error}
          </div>
        )}

        {/* Primary Actions for New Users */}
        <div className="space-y-4 pt-2">
          <button
            onClick={handleQuickLogin}
            disabled={loading}
            className="w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg shadow-lg shadow-[var(--color-primary)]/20 cursor-pointer"
          >
            <Zap size={24} />
            {loading ? t('verifying') : (isAr ? 'الدخول السريع للتجربة' : 'Quick Trial Login')}
          </button>

          <button
            onClick={handleRequestSubscription}
            className="w-full py-3.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <MessageCircle size={22} />
            {isAr ? 'طلب تفعيل أو اشتراك' : 'Request Subscription'}
          </button>
        </div>

        {/* Advanced Login Toggle */}
        <div className="pt-6 border-t border-black/5 dark:border-white/5">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-[var(--text)] transition-colors font-semibold cursor-pointer"
          >
            {isAr ? 'دخول متقدم / موظف' : 'Advanced / Employee Login'}
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Advanced Login Form */}
        {showAdvanced && (
          <form onSubmit={handleAdvancedSubmit} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div>
              <label className="block text-sm font-medium mb-1">{t('username') || 'Username'}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                  placeholder="admin"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('password') || 'Password'}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                  placeholder="••••••"
                />
              </div>
            </div>

            {availableBranches.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">{t('branch') || 'Branch'}</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all cursor-pointer"
                  >
                    <option value="">{t('select_branch') || 'Select Branch'}</option>
                    {availableBranches.map(b => (
                      <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('verifying') : (t('login') || 'Login')}
            </button>
          </form>
        )}
      </div>

      {/* Developer Login Link - Discrete at bottom */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <a href="/owner-portal" className="text-xs text-gray-400 hover:text-[var(--color-primary)] transition-colors opacity-60 hover:opacity-100 cursor-pointer">
          {isAr ? 'دخول المطور' : 'Developer Login'}
        </a>
      </div>
    </div>
  );
};
