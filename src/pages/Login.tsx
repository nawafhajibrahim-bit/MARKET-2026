import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, User, Lock, Store, Zap, MessageCircle, ChevronDown, ChevronUp, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../database/Provider';
import { hashPassword, generateSalt } from '../services/passwordService';

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
  const db = useDb();
  const [isLicensed, setIsLicensed] = useState<boolean>(false);

  // First run setup state
  const [isFirstRun, setIsFirstRun] = useState<boolean>(false);
  const [setupName, setSetupName] = useState('');
  const [setupPassword, setSetupPassword] = useState('');

  useEffect(() => {
    if (!db) return;
    const checkStatus = async () => {
      try {
        // Check license
        const configDoc = await db.system_config.findOne('config').exec();
        if (configDoc) {
          const config = configDoc.toJSON();
          const licensed = config.activation_status === true && !!config.license_key;
          setIsLicensed(licensed);
          if (licensed) {
            setShowAdvanced(true);
          }
        }

        // Check if first run (only admin user exists and has no password salt = never logged in)
        const users = await db.users.find().exec();
        if (users.length === 1 && users[0].username === 'admin' && !users[0].password_salt) {
          setIsFirstRun(true);
        }
      } catch (err) {
        console.error('Error checking system status in Login:', err);
      }
    };
    checkStatus();
  }, [db]);

  useEffect(() => {
    if (availableBranches.length > 0 && !selectedBranch) {
      setSelectedBranch(availableBranches[0].branch_id);
    }
  }, [availableBranches, selectedBranch]);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName.trim() || !setupPassword) {
      setError(isAr ? 'يرجى إدخال اسمك وكلمة مرور جديدة' : 'Please enter your name and a new password');
      return;
    }
    if (setupPassword.length < 4) {
      setError(isAr ? 'كلمة المرور يجب أن تكون 4 رموز على الأقل' : 'Password must be at least 4 characters');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      if (!db) throw new Error('Database not initialized');
      
      const adminDoc = await db.users.findOne({ selector: { username: { $eq: 'admin' } } }).exec();
      if (!adminDoc) throw new Error('Admin account not found');

      const newSalt = generateSalt();
      const newHash = await hashPassword(setupPassword, newSalt);

      await adminDoc.incrementalPatch({
        display_name: setupName.trim(),
        password_hash: newHash,
        password_salt: newSalt
      });

      // Auto login with new password
      const result = await login('admin', setupPassword);
      if (result.success && selectedBranch) {
        await switchBranch(selectedBranch);
      }
      if (!result.success) {
        setError(result.error || 'Login failed after setup');
      }
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.message || 'Setup failed');
    }

    setLoading(false);
  };

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

  if (isFirstRun) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--text)] p-4 relative">
        <div className="w-full max-w-md bg-white dark:bg-[#1f2028] rounded-2xl shadow-xl border border-black/5 dark:border-white/5 p-8 space-y-6 z-10 animate-in zoom-in-95 duration-500">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck size={36} className="text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold">{isAr ? 'مرحباً بك في النظام!' : 'Welcome to the System!'}</h1>
            <p className="text-sm text-gray-500 mb-6">
              {isAr ? 'يبدو أن هذه هي المرة الأولى لتشغيل البرنامج. لنقم بإعداد حساب المدير الخاص بك لتأمين النظام.' : 'It looks like this is your first run. Let\'s set up your admin account to secure the system.'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm text-center font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSetupSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold mb-1.5">{isAr ? 'اسمك الكريم' : 'Your Name'}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-medium"
                  placeholder={isAr ? 'مثال: أحمد' : 'e.g. Ahmed'}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">{isAr ? 'كلمة مرور جديدة للمدير' : 'New Admin Password'}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-medium tracking-widest"
                  placeholder="••••••"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {isAr ? 'سيتم استخدام اسم المستخدم الثابت (admin) للدخول دائماً.' : 'The username (admin) will always be used for login.'}
              </p>
            </div>

            {availableBranches.length > 0 && (
              <div>
                <label className="block text-sm font-bold mb-1.5">{t('branch') || 'Branch'}</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all cursor-pointer font-medium appearance-none"
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
              className="w-full py-4 mt-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-95 text-lg"
            >
              {loading ? t('verifying') : (isAr ? 'حفظ والبدء الآن' : 'Save and Start Now')}
              <ArrowRight size={20} className={isAr ? 'rotate-180' : ''} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--text)] p-4 relative">
      <div className="w-full max-w-md bg-white dark:bg-[#1f2028] rounded-2xl shadow-xl border border-black/5 dark:border-white/5 p-8 space-y-6 z-10">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mb-4">
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

        {!isLicensed && (
          <>
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

            <div className="pt-6 border-t border-black/5 dark:border-white/5">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-[var(--text)] transition-colors font-semibold cursor-pointer"
              >
                {isAr ? 'دخول متقدم / موظف' : 'Advanced / Employee Login'}
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </>
        )}

        {showAdvanced && (
          <form onSubmit={handleAdvancedSubmit} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div>
              <label className="block text-sm font-bold mb-1.5">{t('username') || 'Username'}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-medium"
                  placeholder="admin"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">{t('password') || 'Password'}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-medium tracking-widest"
                  placeholder="••••••"
                />
              </div>
            </div>

            {availableBranches.length > 0 && (
              <div>
                <label className="block text-sm font-bold mb-1.5">{t('branch') || 'Branch'}</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all cursor-pointer font-medium appearance-none"
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
              className="w-full py-4 mt-2 bg-[var(--color-primary)] text-white hover:brightness-110 font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[var(--color-primary)]/20 active:scale-95"
            >
              {loading ? t('verifying') : (t('login') || 'Login')}
            </button>
          </form>
        )}
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <a href="/owner-portal" className="text-xs text-gray-400 hover:text-[var(--color-primary)] transition-colors opacity-60 hover:opacity-100 cursor-pointer">
          {isAr ? 'دخول المطور' : 'Developer Login'}
        </a>
      </div>
    </div>
  );
};

