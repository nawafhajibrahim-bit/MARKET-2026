import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, User, Lock, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const { login, availableBranches, switchBranch } = useAuth();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)] p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1f2028] rounded-2xl shadow-xl border border-black/5 dark:border-white/5 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
            <LogIn size={32} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="text-2xl font-bold">{t('app_name')}</h1>
          <p className="text-sm text-gray-500">{t('welcome')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                required
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
                required
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

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? t('verifying') : (t('login') || 'Login')}
          </button>
        </form>


      </div>
    </div>
  );
};
