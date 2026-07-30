import React, { useEffect, useState } from 'react';
import { useDb } from '../database/Provider';
import { useTranslation } from 'react-i18next';
import { X, Lock, KeyRound, ShieldAlert, PhoneCall } from 'lucide-react';
import { getHardwareFingerprint } from '../services/fingerprintService';
import { encryptData, decryptData } from '../services/cryptoService';

const DEMO_LICENSE_KEY = 'TEST-LICENSE';
const isDemoLoginEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';
const OWNER_PHONE = '009647510171376';
const OWNER_WHATSAPP_URL = 'https://wa.me/9647510171376';

export const LicenseInterceptor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useDb();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(true);

  useEffect(() => {
    if (warningMessage) {
      const snoozedUntilStr = localStorage.getItem('license_warning_snooze_until');
      if (snoozedUntilStr) {
        const snoozedUntil = new Date(snoozedUntilStr);
        if (new Date() < snoozedUntil) {
          setShowWarning(false);
          return;
        }
      }
      setShowWarning(true);
    }
  }, [warningMessage]);

  const applyExpirationWarnings = (daysLeft: number, isTrial: boolean, isOffline: boolean = false) => {
    if (daysLeft <= 15) {
      if (isTrial) {
        if (daysLeft <= 3) {
          setWarningMessage(`تنبيه هام: متبقي لديك ${daysLeft} أيام فقط في الفترة التجريبية ${isOffline ? '(أوفلاين)' : ''}. يرجى أخذ نسخة احتياطية من بياناتك لتجنب فقدانها عند انتهاء التجربة وقفل البرنامج. للتفعيل الكامل اتصل بنا: ${OWNER_PHONE}`);
        } else {
          setWarningMessage(`تحذير: أنت في الفترة التجريبية المجانية ${isOffline ? '(أوفلاين)' : ''}، متبقي لديك ${daysLeft} أيام. للطلب وتفعيل النسخة الكاملة اتصل بنا: ${OWNER_PHONE}`);
        }
      } else {
        if (daysLeft <= 3) {
          setWarningMessage(`تنبيه هام جداً: اشتراكك سينتهي خلال ${daysLeft} أيام! ${isOffline ? '(أوفلاين)' : ''} يرجى طلب تمديد الاشتراك فوراً لتجنب توقف النظام. للتمديد اتصل بنا: ${OWNER_PHONE}`);
        } else {
          setWarningMessage(`تنبيه: اقترب موعد انتهاء اشتراكك. متبقي ${daysLeft} أيام. يرجى طلب تمديد الاشتراك لضمان استمرار عمل النظام. للتواصل: ${OWNER_PHONE}`);
        }
      }
    } else {
      setWarningMessage(null);
    }
  };

  const [inputKey, setInputKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    const checkLicense = async () => {
      try {
        const hwFingerprint = await getHardwareFingerprint();

        // 1. Get or create local config
        let configDoc = await db.system_config.findOne('config').exec();
        
        if (!configDoc) {
          configDoc = await db.system_config.insert({
            id: 'config',
            license_key: '',
            activation_status: false,
            last_sync_timestamp: '',
            offline_grace_days_left: 14,
            hardware_fingerprint: hwFingerprint,
            activation_token: '',
            clock_tamper_detected: false
          }).catch(async () => {
            return await db.system_config.findOne('config').exec();
          });
        }

        if (!configDoc) {
          if (isMounted) setIsAuthorized(false);
          return;
        }

        const { 
          license_key, 
          activation_status, 
          last_sync_timestamp, 
          activation_token, 
          clock_tamper_detected 
        } = configDoc.toJSON();

        // Check for clock manipulation
        const lastSync = last_sync_timestamp ? new Date(last_sync_timestamp) : null;
        const now = new Date();

        if (clock_tamper_detected || (lastSync && now < lastSync)) {
          if (lastSync && now < lastSync) {
            await configDoc.incrementalPatch({ clock_tamper_detected: true });
          }
          if (isMounted) {
            setErrorMsg(t('clock_tamper_error') || 'تم كشف تلاعب في ساعة النظام. يرجى ضبط ساعة الكمبيوتر وتوصيل الإنترنت لتفعيل الترخيص.');
            setIsAuthorized(false);
          }
          return;
        }

        // If not activated, show lock screen
        if (!activation_status || !license_key) {
           if (isMounted) setIsAuthorized(false);
           return;
        }

        const isDemoBypassKey = license_key === 'TEST-LICENSE' || 
                                 license_key === 'TEST' || 
                                 license_key === '1234' || 
                                 license_key === '123456' || 
                                 license_key === '123';

        if (isDemoLoginEnabled && isDemoBypassKey) {
            if (isMounted) {
                setWarningMessage(null);
                setIsAuthorized(true);
            }
            return;
        }

        const isTrial = license_key === 'TRIAL';

        // 2. Offline Verification first
        let expiryDateStr = '';
        try {
          if (!activation_token) {
            throw new Error('No activation token found');
          }
          const decrypted = await decryptData(activation_token, hwFingerprint);
          const parsed = JSON.parse(decrypted);
          
          if (parsed.hw_fingerprint !== hwFingerprint || parsed.license_key !== license_key) {
            throw new Error('Hardware ID mismatch');
          }
          expiryDateStr = parsed.expiry_date;
        } catch (err) {
          console.error('License decryption/mismatch error:', err);
          if (isMounted) {
            setErrorMsg((t('license_invalid') || 'الترخيص غير صالح') + ' (Hardware mismatch)');
            setIsAuthorized(false);
          }
          return;
        }

        // For Trial, check if local expiry is exceeded
        if (isTrial && expiryDateStr) {
          const trialExpiry = new Date(expiryDateStr);
          if (now > trialExpiry) {
            await configDoc.incrementalPatch({ activation_status: false });
            if (isMounted) {
              setErrorMsg('انتهت الفترة التجريبية المجانية (14 يوماً). يرجى تفعيل البرنامج.');
              setIsAuthorized(false);
            }
            return;
          }
        }

        // Calculate days passed since last sync
        let daysPassed = 0;
        if (lastSync) {
          const diffTime = now.getTime() - lastSync.getTime();
          daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        // 3. Online validation if connected
        if (navigator.onLine) {
            try {
                let res;
                if (isTrial) {
                  res = await fetch('/api/start-trial', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ hw_fingerprint: hwFingerprint })
                  });
                } else {
                  res = await fetch('/api/verify-license', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ license_key, hw_fingerprint: hwFingerprint })
                  });
                }

                const data = await res.json().catch(() => ({}));
                if (res.ok && data.active) {
                    const newSyncTime = new Date().toISOString();
                    const tokenPayload = JSON.stringify({ 
                      license_key, 
                      hw_fingerprint: hwFingerprint,
                      expiry_date: data.expiry_date
                    });
                    const newActivationToken = await encryptData(tokenPayload, hwFingerprint);

                    await configDoc.incrementalPatch({ 
                      offline_grace_days_left: 14,
                      last_sync_timestamp: newSyncTime,
                      activation_token: newActivationToken,
                      clock_tamper_detected: false
                    });

                    if (isMounted) {
                      const daysLeft = Math.max(0, Math.ceil((new Date(data.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                      applyExpirationWarnings(daysLeft, isTrial, false);
                      setIsAuthorized(true);
                    }
                    return;
                } else {
                    const errorType = data.error || 'license_verify_failed';
                    await configDoc.incrementalPatch({ activation_status: false });
                    if (isMounted) {
                        setErrorMsg(errorType === 'trial_expired' ? 'انتهت الفترة التجريبية المجانية (14 يوماً). يرجى تفعيل البرنامج.' : (t(errorType) || errorType));
                        setIsAuthorized(false);
                    }
                    return;
                }
            } catch (err) {
                console.warn('Network error during license check, falling back to offline grace.', err);
            }
        }

        // 4. Offline grace check for normal licenses & trials
        if (expiryDateStr) {
          const daysLeft = Math.max(0, Math.ceil((new Date(expiryDateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          if (isMounted) {
            applyExpirationWarnings(daysLeft, isTrial, true);
          }
          if (isTrial) {
            if (isMounted) setIsAuthorized(true);
            return;
          }
        }

        const remainingGrace = Math.max(0, 14 - daysPassed);
        if (remainingGrace > 0) {
            await configDoc.incrementalPatch({ offline_grace_days_left: remainingGrace });
            if (isMounted) {
                setWarningMessage(t('offline_warning', { days: remainingGrace }) || `أنت تعمل بدون اتصال بالإنترنت. يرجى الاتصال خلال ${remainingGrace} أيام للتحقق من الترخيص.`);
                setIsAuthorized(true);
            }
        } else {
            await configDoc.incrementalPatch({ offline_grace_days_left: 0 });
            if (isMounted) {
                setErrorMsg(t('offline_lock') || 'انتهت فترة السماح للعمل بدون اتصال بالإنترنت. يرجى توصيل الجهاز بالإنترنت فوراً للتحقق من الترخيص.');
                setIsAuthorized(false);
            }
        }

      } catch (err) {
        console.error('License check failed:', err);
        if (isMounted) {
          setErrorMsg(t('license_error') || 'خطأ في قاعدة بيانات التراخيص.');
          setIsAuthorized(false);
        }
      }
    };

    checkLicense();

    return () => { isMounted = false; };
  }, [db, t]);

  const handleStartTrial = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const hwFingerprint = await getHardwareFingerprint();
      const res = await fetch('/api/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hw_fingerprint: hwFingerprint })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.active) {
        const tokenPayload = JSON.stringify({ 
          license_key: 'TRIAL', 
          hw_fingerprint: hwFingerprint,
          expiry_date: data.expiry_date
        });
        const activationToken = await encryptData(tokenPayload, hwFingerprint);

        await db.system_config.insert({
          id: 'config',
          license_key: 'TRIAL',
          activation_status: true,
          offline_grace_days_left: 14,
          last_sync_timestamp: new Date().toISOString(),
          hardware_fingerprint: hwFingerprint,
          activation_token: activationToken,
          clock_tamper_detected: false
        }).catch(async () => {
          const existing = await db.system_config.findOne('config').exec();
          if (existing) {
            await existing.incrementalPatch({
              license_key: 'TRIAL',
              activation_status: true,
              offline_grace_days_left: 14,
              last_sync_timestamp: new Date().toISOString(),
              hardware_fingerprint: hwFingerprint,
              activation_token: activationToken,
              clock_tamper_detected: false
            });
          }
        });

        const daysLeft = Math.max(0, Math.ceil((new Date(data.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
        setWarningMessage(`تحذير: أنت في الفترة التجريبية المجانية، متبقي لديك ${daysLeft} أيام. للطلب وتفعيل النسخة الكاملة اتصل بنا: ${OWNER_PHONE}`);
        setIsAuthorized(true);
      } else {
        const errorType = data.error || 'trial_failed';
        setErrorMsg(errorType === 'trial_expired' ? 'عذراً، هذا الجهاز استخدم الفترة التجريبية مسبقاً ولا يمكن تفعيلها مجدداً.' : 'فشل بدء الفترة التجريبية.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('خطأ في الشبكة، لم نتمكن من بدء الفترة التجريبية.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (licenseKey = inputKey) => {
      if (!licenseKey) return;
      setLoading(true);
      setErrorMsg('');

      try {
          const hwFingerprint = await getHardwareFingerprint();
          const tokenPayload = JSON.stringify({ license_key: licenseKey, hw_fingerprint: hwFingerprint });
          const activationToken = await encryptData(tokenPayload, hwFingerprint);

          const isDemoBypassKey = licenseKey === DEMO_LICENSE_KEY || 
                                   licenseKey === 'TEST' || 
                                   licenseKey === '1234' || 
                                   licenseKey === '123456' || 
                                   licenseKey === '123';
          if (isDemoLoginEnabled && isDemoBypassKey) {
              await db.system_config.insert({
                  id: 'config',
                  license_key: licenseKey,
                  activation_status: true,
                  offline_grace_days_left: 14,
                  last_sync_timestamp: new Date().toISOString(),
                  hardware_fingerprint: hwFingerprint,
                  activation_token: activationToken,
                  clock_tamper_detected: false
              }).catch(async () => {
                  const existing = await db.system_config.findOne('config').exec();
                  if (existing) {
                      await existing.incrementalPatch({ 
                        license_key: licenseKey, 
                        activation_status: true, 
                        offline_grace_days_left: 14,
                        last_sync_timestamp: new Date().toISOString(),
                        hardware_fingerprint: hwFingerprint,
                        activation_token: activationToken,
                        clock_tamper_detected: false
                      });
                  }
              });
              setIsAuthorized(true);
              return;
          }

          // Real verification call to Vercel KV
          const res = await fetch('/api/verify-license', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ license_key: licenseKey, hw_fingerprint: hwFingerprint })
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.active) {
              const fullTokenPayload = JSON.stringify({ 
                license_key: licenseKey, 
                hw_fingerprint: hwFingerprint,
                expiry_date: data.expiry_date
              });
              const encryptedToken = await encryptData(fullTokenPayload, hwFingerprint);

              await db.system_config.insert({
                  id: 'config',
                  license_key: licenseKey,
                  activation_status: true,
                  offline_grace_days_left: 14,
                  last_sync_timestamp: new Date().toISOString(),
                  hardware_fingerprint: hwFingerprint,
                  activation_token: encryptedToken,
                  clock_tamper_detected: false
              }).catch(async () => {
                  const existing = await db.system_config.findOne('config').exec();
                  if (existing) {
                      await existing.incrementalPatch({ 
                        license_key: licenseKey, 
                        activation_status: true, 
                        offline_grace_days_left: 14,
                        last_sync_timestamp: new Date().toISOString(),
                        hardware_fingerprint: hwFingerprint,
                        activation_token: encryptedToken,
                        clock_tamper_detected: false
                      });
                  }
              });
              setWarningMessage(null);
              setIsAuthorized(true);
          } else {
              const errorType = data.error || 'license_invalid';
              setErrorMsg(t(errorType) || errorType);
          }
      } catch {
          setErrorMsg(t('license_error') || 'حدث خطأ في الشبكة.');
      } finally {
          setLoading(false);
      }
  };

  if (isAuthorized === false) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 text-center">
              <div className="bg-white dark:bg-[#1f2028] p-8 rounded-2xl border border-red-500/30 max-w-md w-full shadow-lg space-y-6 animate-in fade-in duration-300">
                 <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center relative cursor-pointer group" onClick={() => window.location.href = '/owner-portal'} title={isAr ? 'دخول المالك' : 'Owner Login'}>
                     <Lock size={32} className="text-red-500 group-hover:scale-110 transition-transform" />
                     <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-[#1f2028]"></div>
                 </div>
                 <h1 className="text-2xl font-bold text-red-500">{t('license_required') || 'تفعيل البرنامج مطلوب'}</h1>
                 <p className="text-sm opacity-80 leading-relaxed">
                     {t('license_missing_desc') || 'رخصة برنامجك مفقودة أو منتهية الصلاحية. يرجى إدخال مفتاح ترخيص صالح أدناه أو بدء الفترة التجريبية.'}
                 </p>

                 {/* Owner Contact Card */}
                 <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl text-center space-y-2">
                   <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center justify-center gap-1">
                     <PhoneCall size={12} />
                     لطلب وتفعيل النسخة الكاملة أو تمديد اشتراكك:
                   </p>
                   <a 
                     href={OWNER_WHATSAPP_URL} 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="inline-flex items-center gap-2 font-bold text-sm text-[var(--color-primary)] hover:underline active:scale-95 transition-transform"
                   >
                     💬 اتصال واتساب / تليجرام: <span className="font-mono">{OWNER_PHONE}</span>
                   </a>
                 </div>

                 <div className="space-y-4">
                   <div className="space-y-3">
                     <input 
                        type="text" 
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        placeholder={t('license_placeholder') || 'أدخل مفتاح الترخيص (مثال: SM-XXXX)'} 
                        className="w-full px-4 py-3 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none font-mono text-center dir-ltr text-lg"
                     />
                     {errorMsg && <p className="text-red-500 text-sm font-semibold">{errorMsg}</p>}
                     
                     <button 
                        onClick={() => handleActivate()}
                        disabled={loading}
                        className="w-full py-3 bg-[var(--color-primary)] hover:brightness-110 text-white font-bold rounded-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-md flex items-center justify-center gap-2"
                     >
                         <KeyRound size={18} />
                         {loading ? t('verifying') : (t('activate_license') || 'تفعيل الترخيص')}
                     </button>
                   </div>

                   <div className="relative flex py-2 items-center">
                       <div className="flex-grow border-t border-black/10 dark:border-white/10"></div>
                       <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase">أو جرب البرنامج مجاناً</span>
                       <div className="flex-grow border-t border-black/10 dark:border-white/10"></div>
                   </div>

                   <button
                     onClick={handleStartTrial}
                     disabled={loading}
                     className="w-full py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text)] font-semibold rounded-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                   >
                     ⚡ بدء فترة تجريبية مجانية (14 يوماً)
                   </button>
                 </div>
              </div>
          </div>
      );
  }

  return (
      <>
        {warningMessage && showWarning && (
            <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white text-center p-2.5 px-4 text-sm font-medium z-[100] flex justify-between items-center gap-2 shadow-lg animate-in slide-in-from-top duration-300">
                <div className="flex-1 flex justify-center items-center gap-2">
                    <ShieldAlert size={16} />
                    <span>{warningMessage}</span>
                </div>
                <button 
                  onClick={() => {
                    setShowWarning(false);
                    if (warningMessage) {
                      const snoozeDate = new Date();
                      snoozeDate.setDate(snoozeDate.getDate() + 3);
                      localStorage.setItem('license_warning_snooze_until', snoozeDate.toISOString());
                    }
                  }}
                  className="p-1 hover:bg-orange-600 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Close warning"
                >
                  <X size={16} />
                </button>
            </div>
        )}
        {children}
      </>
  );
};
