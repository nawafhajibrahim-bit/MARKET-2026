import React, { useEffect, useState } from 'react';
import { useDb } from '../database/Provider';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { getHardwareFingerprint } from '../services/fingerprintService';
import { encryptData, decryptData } from '../services/cryptoService';

const DEMO_LICENSE_KEY = 'TEST-LICENSE';
const isDemoLoginEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false';

export const LicenseInterceptor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useDb();
  const { t } = useTranslation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(true);

  const [inputKey, setInputKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    const checkLicense = async () => {
      try {
        const hwFingerprint = await getHardwareFingerprint();

        // 1. Get local config
        const configDoc = await db.system_config.findOne('config').exec();
        
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

        // If it's a demo key and activated, authorize directly without showing the offline warning bar
        const isDemoBypassKey = license_key === 'TEST-LICENSE' || 
                                 license_key === 'TEST' || 
                                 license_key === '1234' || 
                                 license_key === '123456' || 
                                 license_key === '123';

        if (isDemoLoginEnabled && isDemoBypassKey && activation_status) {
            if (isMounted) {
                setWarningMessage(null);
                setIsAuthorized(true);
            }
            return;
        }

        // Check for clock manipulation
        const lastSync = last_sync_timestamp ? new Date(last_sync_timestamp) : null;
        const now = new Date();

        if (clock_tamper_detected || (lastSync && now < lastSync)) {
          if (lastSync && now < lastSync) {
            await configDoc.incrementalPatch({ clock_tamper_detected: true });
          }
          if (isMounted) {
            setErrorMsg(t('clock_tamper_error'));
            setIsAuthorized(false);
          }
          return;
        }

        if (!activation_status) {
           if (isMounted) setIsAuthorized(false);
           return;
        }

        // Verify Hardware Fingerprint offline
        try {
          if (!activation_token) {
            throw new Error('No activation token found');
          }
          const decrypted = await decryptData(activation_token, hwFingerprint);
          const parsed = JSON.parse(decrypted);
          if (parsed.hw_fingerprint !== hwFingerprint || parsed.license_key !== license_key) {
            throw new Error('Hardware ID mismatch');
          }
        } catch (err) {
          console.error('License decryption/mismatch error:', err);
          if (isMounted) {
            setErrorMsg(t('license_invalid') + ' (Hardware mismatch)');
            setIsAuthorized(false);
          }
          return;
        }

        // Calculate actual offline days passed
        let daysPassed = 0;
        if (lastSync) {
          const diffTime = now.getTime() - lastSync.getTime();
          daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        // 2. Try to ping online
        if (navigator.onLine) {
            try {
                const res = await fetch('/api/verify-license', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ license_key, hw_fingerprint: hwFingerprint })
                });

                const data = await res.json().catch(() => ({}));
                if (res.ok && data.active) {
                    const newSyncTime = new Date().toISOString();
                    const tokenPayload = JSON.stringify({ license_key, hw_fingerprint: hwFingerprint });
                    const newActivationToken = await encryptData(tokenPayload, hwFingerprint);

                    await configDoc.incrementalPatch({ 
                      offline_grace_days_left: 5,
                      last_sync_timestamp: newSyncTime,
                      activation_token: newActivationToken,
                      clock_tamper_detected: false
                    });

                    if (isMounted) {
                      setWarningMessage(null);
                      setIsAuthorized(true);
                    }
                    return;
                } else {
                    const errorType = data.error || 'license_verify_failed';
                    await configDoc.incrementalPatch({ activation_status: false });
                    if (isMounted) {
                        setErrorMsg(t(errorType) || errorType);
                        setIsAuthorized(false);
                    }
                    return;
                }
            } catch (err) {
                console.warn('Network error during license check, falling back to offline grace.', err);
            }
        }

        // 3. Offline logic (5 days grace limit)
        const remainingGrace = Math.max(0, 5 - daysPassed);
        if (remainingGrace > 0) {
            await configDoc.incrementalPatch({ offline_grace_days_left: remainingGrace });
            if (isMounted) {
                setWarningMessage(t('offline_warning', { days: remainingGrace }));
                setIsAuthorized(true);
            }
        } else {
            await configDoc.incrementalPatch({ offline_grace_days_left: 0 });
            if (isMounted) {
                setErrorMsg(t('offline_lock'));
                setIsAuthorized(false);
            }
        }

      } catch (err) {
        console.error('License check failed:', err);
        // Fail-closed to protect the application
        if (isMounted) {
          setErrorMsg(t('license_error') || 'License database error.');
          setIsAuthorized(false);
        }
      }
    };

    checkLicense();

    return () => { isMounted = false; };
  }, [db, t]);

  if (isAuthorized === null) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse flex items-center gap-2">
             <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
             <div className="w-4 h-4 bg-purple-500 rounded-full delay-75"></div>
             <div className="w-4 h-4 bg-purple-500 rounded-full delay-150"></div>
          </div>
        </div>
      );
  }

  const handleActivate = async (licenseKey = inputKey) => {
      if (!licenseKey) return;
      setLoading(true);
      setErrorMsg('');

      try {
          const hwFingerprint = await getHardwareFingerprint();
          const tokenPayload = JSON.stringify({ license_key: licenseKey, hw_fingerprint: hwFingerprint });
          const activationToken = await encryptData(tokenPayload, hwFingerprint);

          // If offline or testing, allow demo bypass keys only if demo login is enabled
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
                  offline_grace_days_left: 5,
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
                        offline_grace_days_left: 5,
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

          // Real check
          const res = await fetch('/api/verify-license', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ license_key: licenseKey, hw_fingerprint: hwFingerprint })
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.active) {
              await db.system_config.insert({
                  id: 'config',
                  license_key: licenseKey,
                  activation_status: true,
                  offline_grace_days_left: 5,
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
                        offline_grace_days_left: 5,
                        last_sync_timestamp: new Date().toISOString(),
                        hardware_fingerprint: hwFingerprint,
                        activation_token: activationToken,
                        clock_tamper_detected: false
                      });
                  }
              });
              setIsAuthorized(true);
          } else {
              const errorType = data.error || 'license_invalid';
              setErrorMsg(t(errorType) || errorType);
          }
      } catch {
          setErrorMsg(t('license_error'));
      } finally {
          setLoading(false);
      }
  };

  if (isAuthorized === false) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 text-center">
              <div className="bg-white dark:bg-[#1f2028] p-8 rounded-2xl border border-red-500/30 max-w-md w-full shadow-lg space-y-4">
                 <h1 className="text-3xl font-bold text-red-500">{t('license_required')}</h1>
                 <p className="text-sm opacity-80">
                     {t('license_missing_desc')}
                 </p>

                 {isDemoLoginEnabled && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleActivate(DEMO_LICENSE_KEY)}
                        disabled={loading}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-lg text-lg flex items-center justify-center gap-2"
                      >
                        ⚡ {t('demo_login')}
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {t('test_bypass_desc')}
                      </p>
                    </div>
                 )}

                 {isDemoLoginEnabled && (
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-black/10 dark:border-white/10"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase">{t('or_enter_license')}</span>
                        <div className="flex-grow border-t border-black/10 dark:border-white/10"></div>
                    </div>
                 )}

                 <div className="space-y-3">
                   <input 
                      type="text" 
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder={t('license_placeholder')} 
                      className="w-full px-4 py-3 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none font-mono text-center dir-ltr"
                   />
                   {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
                   
                   <button 
                      onClick={() => handleActivate()}
                      disabled={loading}
                      className="w-full py-3 border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 font-bold rounded-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                   >
                       {loading ? t('verifying') : t('activate_license')}
                   </button>
                 </div>
              </div>
          </div>
      );
  }

  return (
      <>
        {warningMessage && showWarning && (
            <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white text-center p-2 px-4 text-sm font-medium z-[100] flex justify-between items-center gap-2">
                <div className="flex-1 flex justify-center items-center gap-2">
                    <span>⚠️</span>
                    <span>{warningMessage}</span>
                </div>
                <button 
                  onClick={() => setShowWarning(false)}
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
