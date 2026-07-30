import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ShieldCheck, CheckCircle, KeyRound } from 'lucide-react';
import { useDb } from '../database/Provider';
import { getHardwareFingerprint } from '../services/fingerprintService';
import { encryptData } from '../services/cryptoService';

interface SubscriptionModalProps {
  onClose: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const db = useDb();
  
  const [sysConfig, setSysConfig] = useState<any>(null);
  
  // Extension Request States
  const [reqDuration, setReqDuration] = useState<number>(3);
  const [reqPhone, setReqPhone] = useState<string>('');
  const [reqShopName, setReqShopName] = useState<string>('');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);

  // Activation States
  const [activationKey, setActivationKey] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState('');
  const [activationError, setActivationError] = useState('');

  useEffect(() => {
    if (db) {
      db.system_config.findOne('config').exec().then(doc => {
        if (doc) setSysConfig(doc.toJSON());
      });
    }
  }, [db]);

  const handleRequestExtension = async () => {
    if (!reqPhone.trim() || !reqShopName.trim()) {
      alert(isAr ? 'يرجى إدخال اسم المشترك ورقم الهاتف' : 'Please enter subscriber name and phone number');
      return;
    }
    if (!reqPhone.startsWith('+')) {
      alert(isAr ? 'الرجاء كتابة النداء الدولي قبل رقم الهاتف (مثال: +964)' : 'Please include the country code before the phone number (e.g. +964)');
      return;
    }
    if (reqPhone.length < 8) {
      alert(isAr ? 'رقم الهاتف المدخل غير صحيح' : 'Invalid phone number');
      return;
    }
    setReqLoading(true);
    try {
      const res = await fetch('/api/license-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          merchant_name: reqShopName,
          phone: reqPhone,
          duration_months: reqDuration,
          hardware_fingerprint: sysConfig?.hardware_fingerprint || 'unknown',
          current_license_key: sysConfig?.license_key || 'trial'
        })
      });

      if (res.ok) {
        setReqSuccess(isAr ? 'تم تجهيز الطلب بنجاح!' : 'Request prepared successfully!');
        
        const msg = isAr 
          ? `مرحباً، أود طلب تمديد/ترقية اشتراكي في نظام إدارة المبيعات لمدة ${reqDuration} أشهر.\n\nالاسم: ${reqShopName}\nالهاتف: ${reqPhone}\nالمعرف: ${sysConfig?.hardware_fingerprint || 'غير متوفر'}\nالترخيص الحالي: ${sysConfig?.license_key || 'فترة تجريبية'}`
          : `Hello, I would like to request a subscription extension for ${reqDuration} months.\n\nName: ${reqShopName}\nPhone: ${reqPhone}\nID: ${sysConfig?.hardware_fingerprint || 'N/A'}\nCurrent License: ${sysConfig?.license_key || 'Trial'}`;
        
        const encodedMsg = encodeURIComponent(msg);
        window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
      } else {
        alert(isAr ? 'حدث خطأ أثناء إرسال الطلب' : 'Failed to send request');
      }
    } catch (err) {
      console.error(err);
      alert(isAr ? 'خطأ في الاتصال' : 'Network error');
    } finally {
      setReqLoading(false);
    }
  };

  const handleActivateLicense = async () => {
    if (!activationKey.trim()) {
      setActivationError(isAr ? 'يرجى إدخال مفتاح التفعيل' : 'Please enter an activation key');
      return;
    }
    setActivationLoading(true);
    setActivationError('');
    setActivationSuccess('');
    
    try {
      const hwFingerprint = await getHardwareFingerprint();
      
      const isDemoBypassKey = activationKey === 'TEST-LICENSE' || 
                               activationKey === 'TEST' || 
                               activationKey === '1234' || 
                               activationKey === '123456' || 
                               activationKey === '123';
      const isDemoLoginEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';
      
      if (isDemoLoginEnabled && isDemoBypassKey) {
          const fullTokenPayload = JSON.stringify({ license_key: activationKey, hw_fingerprint: hwFingerprint });
          const encryptedToken = await encryptData(fullTokenPayload, hwFingerprint);
          const configDoc = await db.system_config.findOne('config').exec();
          if (configDoc) {
              await configDoc.incrementalPatch({ 
                license_key: activationKey, 
                activation_status: true, 
                offline_grace_days_left: 14,
                last_sync_timestamp: new Date().toISOString(),
                hardware_fingerprint: hwFingerprint,
                activation_token: encryptedToken,
                clock_tamper_detected: false
              });
              setSysConfig(configDoc.toJSON());
          }
          setActivationSuccess(isAr ? 'تم تفعيل البرنامج بنجاح! (وضع المطور)' : 'Software activated successfully! (Dev Mode)');
          setActivationKey('');
          setActivationLoading(false);
          return;
      }

      const res = await fetch('/api/verify-license', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license_key: activationKey, hw_fingerprint: hwFingerprint })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.active) {
          const fullTokenPayload = JSON.stringify({ 
            license_key: activationKey, 
            hw_fingerprint: hwFingerprint,
            expiry_date: data.expiry_date
          });
          const encryptedToken = await encryptData(fullTokenPayload, hwFingerprint);

          const configDoc = await db.system_config.findOne('config').exec();
          if (configDoc) {
              await configDoc.incrementalPatch({ 
                license_key: activationKey, 
                activation_status: true, 
                offline_grace_days_left: 14,
                last_sync_timestamp: new Date().toISOString(),
                hardware_fingerprint: hwFingerprint,
                activation_token: encryptedToken,
                clock_tamper_detected: false
              });
              setSysConfig(configDoc.toJSON());
          }
          setActivationSuccess(isAr ? 'تم تفعيل البرنامج بنجاح!' : 'Software activated successfully!');
          setActivationKey('');
      } else {
          const errorType = data.error || 'license_invalid';
          setActivationError(t(errorType) || errorType);
      }
    } catch {
        setActivationError(t('license_error') || 'حدث خطأ في الشبكة.');
    } finally {
        setActivationLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1f2028] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1f2028] z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-primary)]">
            <ShieldCheck size={24} />
            {isAr ? 'الاشتراك والترخيص' : 'Subscription & License'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl">
            <p className="text-sm font-semibold opacity-70 mb-1">{isAr ? 'حالة الترخيص الحالي:' : 'Current License:'}</p>
            <p className="font-mono font-bold text-lg text-[var(--color-primary)]">
              {sysConfig?.license_key || (isAr ? 'فترة تجريبية' : 'Trial Version')}
            </p>
            <p className="text-xs text-gray-500 mt-1">ID: {sysConfig?.hardware_fingerprint}</p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-lg mb-1">{isAr ? 'طلب تمديد أو ترقية الاشتراك' : 'Request Extension / Upgrade'}</h4>
              <p className="text-sm text-gray-500 mb-4">
                {isAr ? 'قم بإرسال طلب للمطور. بعد ذلك ستستلم مفتاح التفعيل لتقوم بإدخاله في الأسفل.' : 'Send a request to the developer to get a new activation key.'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{isAr ? 'اسم المشترك / المحل' : 'Subscriber / Shop Name'}</label>
                <input 
                  type="text"
                  required
                  value={reqShopName}
                  onChange={(e) => setReqShopName(e.target.value)}
                  placeholder={isAr ? "اكتب الاسم هنا" : "Enter name"}
                  className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{isAr ? 'رقم الهاتف (مع النداء الدولي)' : 'Phone (with country code)'}</label>
                <input 
                  type="tel"
                  required
                  value={reqPhone}
                  onChange={(e) => setReqPhone(e.target.value)}
                  placeholder="مثال: +96477000000"
                  className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all dir-ltr"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">{isAr ? 'مدة التمديد المطلوبة' : 'Requested Duration'}</label>
                <select 
                  value={reqDuration}
                  onChange={(e) => setReqDuration(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer transition-all"
                >
                  <option value={1}>{isAr ? 'شهر واحد' : '1 Month'}</option>
                  <option value={3}>{isAr ? '3 أشهر' : '3 Months'}</option>
                  <option value={6}>{isAr ? '6 أشهر' : '6 Months'}</option>
                  <option value={12}>{isAr ? 'سنة كاملة' : '1 Year'}</option>
                  <option value={36}>{isAr ? '3 سنوات' : '3 Years'}</option>
                  <option value={60}>{isAr ? '5 سنوات' : '5 Years'}</option>
                </select>
              </div>
            </div>
            
            <button 
              onClick={handleRequestExtension}
              disabled={reqLoading}
              className="w-full py-3 mt-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              {reqLoading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال الطلب الآن' : 'Send Request')}
            </button>
            
            {reqSuccess && (
              <div className="mt-2 p-3 bg-green-500/10 text-green-600 rounded-lg text-sm font-bold flex items-center gap-2">
                <CheckCircle size={18} />
                {reqSuccess}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-black/10 dark:border-white/10 space-y-4">
              <div>
                  <h4 className="font-medium text-lg mb-1">{isAr ? 'إدخال مفتاح التفعيل / تمديد الاشتراك' : 'Enter Activation Key / Extend Subscription'}</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    {isAr ? 'إذا حصلت على مفتاح تفعيل جديد، قم بإدخاله هنا لتحديث حالة اشتراكك فوراً.' : 'If you received a new activation key, enter it here to update your subscription instantly.'}
                  </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <div className="flex-1 w-full relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text"
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    placeholder={isAr ? "مثال: SM-XXXX-XXXX" : "e.g. SM-XXXX-XXXX"}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-mono dir-ltr"
                  />
                  {activationError && <p className="text-red-500 text-sm font-semibold mt-2">{activationError}</p>}
                  {activationSuccess && <p className="text-green-600 dark:text-green-400 text-sm font-semibold mt-2">{activationSuccess}</p>}
                </div>
                <button 
                  onClick={handleActivateLicense}
                  disabled={activationLoading}
                  className="w-full sm:w-auto px-8 py-3 bg-[var(--color-primary)] hover:brightness-110 disabled:opacity-50 text-white font-bold rounded-lg transition-all cursor-pointer shadow-md whitespace-nowrap"
                >
                  {activationLoading ? (isAr ? 'جاري التحقق...' : 'Verifying...') : (isAr ? 'تفعيل الآن' : 'Activate Now')}
                </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};
