import React, { useState } from 'react';
import { ShieldCheck, KeyRound, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Admin = () => {
  const { t } = useTranslation();
  const [adminSecret, setAdminSecret] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [durationMonths, setDurationMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  const generateLicense = () => {
    return 'SM-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsSuccess(null);

    const licenseKey = generateLicense();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + Number(durationMonths));

    try {
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_secret: adminSecret,
          timestamp: new Date().toISOString(),
          license_key: licenseKey,
          expiry_date: expiryDate.toISOString(),
          status: 'active',
          merchant_name: merchantName
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsSuccess(true);
        setMessage(t('license_success', { key: licenseKey }));
        setMerchantName('');
      } else {
        setIsSuccess(false);
        setMessage(t('license_failed', { error: data.error }));
      }
    } catch {
      setIsSuccess(false);
      setMessage(t('license_network_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b border-black/10 dark:border-white/10 pb-4">
        <ShieldCheck className="text-[var(--color-primary)]" size={32} />
        <h2 className="text-2xl font-bold">{t('admin_title')}</h2>
      </div>

      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
           <PlusCircle size={18} /> {t('generate_license_title')}
        </h3>

        <form onSubmit={handleCreateLicense} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('admin_secret')}</label>
            <input 
              type="password"
              required
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
              placeholder={t('admin_secret_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('merchant_name')}</label>
            <input 
              type="text"
              required
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
              placeholder={t('merchant_name_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('sub_duration')}</label>
            <select 
              value={durationMonths}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer"
            >
              <option value={1}>{t('duration_1_month')}</option>
              <option value={6}>{t('duration_6_months')}</option>
              <option value={12}>{t('duration_1_year')}</option>
              <option value={24}>{t('duration_2_years')}</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:brightness-110 active:scale-95 transition-all font-bold disabled:opacity-50 cursor-pointer"
          >
            {loading ? t('processing') : <><KeyRound size={18} /> {t('generate_and_save')}</>}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-lg text-sm font-medium ${isSuccess ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-500/20 text-red-700 dark:text-red-400'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};
