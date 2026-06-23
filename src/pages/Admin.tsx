import React, { useState, useEffect } from 'react';
import { ShieldCheck, KeyRound, PlusCircle, RefreshCw, Laptop } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Admin = () => {
  const { t } = useTranslation();
  const [adminSecret, setAdminSecret] = useState(() => localStorage.getItem('sm_developer_secret') || '');
  const [merchantName, setMerchantName] = useState('');
  const [durationMonths, setDurationMonths] = useState(12);
  const [maxDevices, setMaxDevices] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  
  const [licensesList, setLicensesList] = useState<Record<string, any>>({});

  // Automatically load licenses on mount if secret is already saved
  useEffect(() => {
    if (adminSecret) {
      fetchLicensesList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          merchant_name: merchantName,
          max_devices: Number(maxDevices)
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsSuccess(true);
        setMessage(t('license_success', { key: licenseKey }) || `تم إنشاء الترخيص بنجاح: ${licenseKey}`);
        setMerchantName('');
        localStorage.setItem('sm_developer_secret', adminSecret);
        // Automatically refresh list
        fetchLicensesList();
      } else {
        setIsSuccess(false);
        setMessage(t('license_failed', { error: data.error }) || `فشل إنشاء الترخيص: ${data.error}`);
      }
    } catch {
      setIsSuccess(false);
      setMessage(t('license_network_error') || 'خطأ في الشبكة، لم يتم حفظ الترخيص');
    } finally {
      setLoading(false);
    }
  };

  const fetchLicensesList = async () => {
    if (!adminSecret) {
      alert(t('enter_admin_secret_first') || 'يرجى إدخال رمز الأدمن أولاً لجلب التراخيص');
      return;
    }
    setListLoading(true);
    try {
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'list',
          timestamp: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLicensesList(data.licenses || {});
        localStorage.setItem('sm_developer_secret', adminSecret);
      } else {
        alert(data.error || 'Failed to fetch licenses');
      }
    } catch (err) {
      console.error(err);
      alert('Network error fetching licenses');
    } finally {
      setListLoading(false);
    }
  };

  const handleUpdateLicenseStatus = async (key: string, newStatus: string) => {
    const license = licensesList[key];
    if (!license) return;
    setListLoading(true);
    try {
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'save',
          license_key: key,
          expiry_date: license.expiry_date,
          status: newStatus,
          merchant_name: license.merchant_name,
          max_devices: license.max_devices || 1,
          timestamp: new Date().toISOString()
        })
      });
      if (res.ok) {
        await fetchLicensesList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update license');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setListLoading(false);
    }
  };

  const handleUpdateMaxDevices = async (key: string, newMax: number) => {
    const license = licensesList[key];
    if (!license) return;
    setListLoading(true);
    try {
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'save',
          license_key: key,
          expiry_date: license.expiry_date,
          status: license.status,
          merchant_name: license.merchant_name,
          max_devices: newMax,
          timestamp: new Date().toISOString()
        })
      });
      if (res.ok) {
        await fetchLicensesList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update device limit');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setListLoading(false);
    }
  };

  const handleExtendLicense = async (key: string, months: number) => {
    const license = licensesList[key];
    if (!license) return;
    setListLoading(true);
    try {
      const currentExpiry = new Date(license.expiry_date);
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      baseDate.setMonth(baseDate.getMonth() + months);

      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'save',
          license_key: key,
          expiry_date: baseDate.toISOString(),
          status: license.status,
          merchant_name: license.merchant_name,
          max_devices: license.max_devices || 1,
          timestamp: new Date().toISOString()
        })
      });
      if (res.ok) {
        await fetchLicensesList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to extend subscription');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setListLoading(false);
    }
  };

  const handleClearDevices = async (key: string) => {
    if (!window.confirm(t('confirm_clear_devices') || 'هل أنت متأكد من مسح جميع الأجهزة المسجلة لهذا الترخيص؟ سيتمكن العميل من تفعيل اشتراكه على جهاز جديد.')) return;
    setListLoading(true);
    try {
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'clear-devices',
          license_key: key,
          timestamp: new Date().toISOString()
        })
      });
      if (res.ok) {
        await fetchLicensesList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset devices');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setListLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sm_developer_secret');
    setAdminSecret('');
    setLicensesList({});
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-[var(--color-primary)]" size={32} />
          <h2 className="text-2xl font-bold">{t('admin_title') || 'لوحة تحكم المطور'}</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {adminSecret && (
            <>
              <button
                onClick={fetchLicensesList}
                disabled={listLoading}
                className="flex items-center gap-2 px-4 py-2 border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={16} className={listLoading ? 'animate-spin' : ''} />
                {t('load_licenses') || 'تحديث القائمة'}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-bold bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
              >
                خروج المطور
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form to generate new license */}
        <div className="lg:col-span-1 bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10 h-fit space-y-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-2">
             <PlusCircle className="text-[var(--color-primary)]" size={18} /> {t('generate_license_title') || 'إنشاء ترخيص جديد'}
          </h3>

          <form onSubmit={handleCreateLicense} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin_secret') || 'رمز المطور السري'}</label>
              <input 
                type="password"
                required
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-mono"
                placeholder={t('admin_secret_placeholder') || 'أدخل رمز المطور'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('merchant_name') || 'اسم التاجر / المحل'}</label>
              <input 
                type="text"
                required
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                placeholder={t('merchant_name_placeholder') || 'مثال: سوبرماركت الهدى'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('sub_duration') || 'مدة الاشتراك'}</label>
              <select 
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer"
              >
                <option value={1}>{t('duration_1_month') || 'شهر واحد (تجربة)'}</option>
                <option value={3}>{t('duration_3_months') || '3 أشهر'}</option>
                <option value={6}>{t('duration_6_months') || '6 أشهر'}</option>
                <option value={12}>{t('duration_1_year') || 'سنة واحدة'}</option>
                <option value={24}>{t('duration_2_years') || 'سنتين'}</option>
                <option value={60}>{t('duration_5_years') || '5 سنوات'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('max_devices_label') || 'الحد الأقصى للأجهزة'}</label>
              <select 
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer"
              >
                <option value={1}>1 {t('device_count_1') || 'جهاز واحد'}</option>
                <option value={2}>2 {t('device_count_2') || 'جهازين'}</option>
                <option value={3}>3 {t('device_count_3') || '3 أجهزة'}</option>
                <option value={5}>5 {t('device_count_5') || '5 أجهزة'}</option>
                <option value={10}>10 {t('device_count_10') || '10 أجهزة'}</option>
                <option value={0}>{t('device_count_unlimited') || 'غير محدود (مفتوح)'}</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-primary)] hover:brightness-110 text-white rounded-lg active:scale-95 transition-all font-bold disabled:opacity-50 cursor-pointer shadow-md"
            >
              {loading ? t('processing') || 'جاري المعالجة...' : <><KeyRound size={18} /> {t('generate_and_save') || 'إنشاء وحفظ الترخيص'}</>}
            </button>
          </form>

          {message && (
            <div className={`p-4 rounded-lg text-sm font-medium border ${isSuccess ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'}`}>
              {message}
            </div>
          )}
        </div>

        {/* List of existing licenses */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10 space-y-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-2">
             <Laptop className="text-[var(--color-primary)]" size={18} /> {t('manage_subscriptions') || 'إدارة الاشتراكات والعملاء'}
          </h3>

          {Object.keys(licensesList).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-black/10 dark:border-white/10 rounded-xl space-y-4">
              <Laptop className="mx-auto text-gray-300 dark:text-gray-600 animate-pulse" size={56} />
              <div className="max-w-xs mx-auto">
                <p className="text-sm font-semibold opacity-70">
                  {t('no_licenses_loaded') || 'لم يتم تحميل أي تراخيص'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('load_licenses_desc') || 'أدخل رمز المطور واضغط على زر التحديث أو جلب قائمة التراخيص لاستعراض وإدارة المشتركين.'}
                </p>
              </div>
              <button
                onClick={fetchLicensesList}
                disabled={!adminSecret || listLoading}
                className="px-6 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {t('fetch_list_btn') || 'جلب قائمة التراخيص'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-xl">
              <table className="w-full text-sm text-right">
                <thead className="bg-black/5 dark:bg-white/5 text-xs uppercase border-b border-black/10 dark:border-white/10">
                  <tr>
                    <th scope="col" className="px-4 py-3">{t('merchant') || 'التاجر / المحل'}</th>
                    <th scope="col" className="px-4 py-3">{t('license_key_header') || 'كود التفعيل'}</th>
                    <th scope="col" className="px-4 py-3">{t('expiry') || 'الانتهاء / تمديد'}</th>
                    <th scope="col" className="px-4 py-3">{t('devices') || 'الأجهزة / مسح'}</th>
                    <th scope="col" className="px-4 py-3 text-center">{t('status') || 'الحالة'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {Object.entries(licensesList).map(([key, value]: [string, any]) => {
                    const expiry = new Date(value.expiry_date);
                    const isExpired = new Date() > expiry;
                    const activeCount = value.activated_devices ? value.activated_devices.length : 0;
                    const maxDev = value.max_devices || 1;

                    return (
                      <tr key={key} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-bold text-[var(--text)]">{value.merchant_name || '---'}</p>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs select-all text-gray-600 dark:text-gray-400">{key}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs font-semibold ${isExpired ? 'text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded w-fit' : 'text-gray-600 dark:text-gray-400'}`}>
                              {expiry.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleExtendLicense(key, Number(e.target.value));
                                  e.target.value = "";
                                }
                              }}
                              className="p-1 text-[10px] rounded bg-black/5 dark:bg-white/5 border border-transparent cursor-pointer outline-none text-[var(--color-primary)] font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-fit flex items-center gap-1"
                            >
                              <option value="" disabled>➕ تمديد الصلاحية</option>
                              <option value={1}>+ شهر 1</option>
                              <option value={3}>+ 3 أشهر</option>
                              <option value={6}>+ 6 أشهر</option>
                              <option value={12}>+ سنة 1</option>
                              <option value={24}>+ سنتين</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <select
                                value={maxDev}
                                onChange={(e) => handleUpdateMaxDevices(key, Number(e.target.value))}
                                className="p-1 text-xs rounded bg-black/5 dark:bg-white/5 border border-transparent cursor-pointer outline-none font-semibold"
                              >
                                <option value={1}>1 جهاز</option>
                                <option value={2}>2 جهازين</option>
                                <option value={3}>3 أجهزة</option>
                                <option value={5}>5 أجهزة</option>
                                <option value={10}>10 أجهزة</option>
                                <option value={0}>∞ مفتوح</option>
                              </select>
                            </div>
                            <span className="text-[10px] text-gray-500">مفعّل: {activeCount} أجهزة</span>
                            {activeCount > 0 && (
                              <button
                                onClick={() => handleClearDevices(key)}
                                className="text-[10px] text-red-500 hover:underline text-right font-medium w-fit"
                              >
                                ♻️ مسح الأجهزة المفعلة
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <select
                            value={value.status}
                            onChange={(e) => handleUpdateLicenseStatus(key, e.target.value)}
                            className={`p-1.5 text-xs rounded border border-transparent font-semibold cursor-pointer outline-none shadow-sm ${
                              value.status === 'active' 
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                : value.status === 'suspended'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}
                          >
                            <option value="active">🟢 {t('status_active') || 'نشط'}</option>
                            <option value="suspended">🟡 {t('status_suspended') || 'موقوف مؤقتاً'}</option>
                            <option value="disabled">🔴 {t('status_disabled') || 'ملغى'}</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
