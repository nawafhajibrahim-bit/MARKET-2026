import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCcw, CheckCircle, AlertCircle, Coins, Printer, Download, Upload, Trash2, Play, HardDrive, FolderOpen, FolderX, UserCheck, X, BookOpen, Info, ArrowUpCircle, ShieldCheck } from 'lucide-react';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { useDb } from '../database/Provider';
import { useAuth } from '../contexts/AuthContext';
import { getCurrenciesList, addCustomCurrency, getOfficialCurrency, setOfficialCurrency, getPOSExchangeRate, setPOSExchangeRate, getPOSHelperCurrency, setPOSHelperCurrency } from '../utils/currency';
import { getLocalBackups, deleteLocalBackup, type LocalBackup } from '../services/backupStorageService';
import { runAutoBackup } from '../components/AutoBackupRunner';
import { hashPassword as secureHashPassword, generateSalt } from '../services/passwordService';
import { getHardwareFingerprint } from '../services/fingerprintService';
import { encryptData } from '../services/cryptoService';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION } from '../utils/version';
import {
  isFolderBackupSupported,
  isFolderBackupEnabled,
  setFolderBackupEnabled,
  getSelectedFolderName,
  getMaxBackupsToKeep,
  setMaxBackupsToKeep,
  pickBackupFolder,
  clearFolderSelection,
} from '../services/folderBackupService';

export const Settings = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const db = useDb();
  
  const { currentUser, isAdmin } = useAuth();

  // PWA update states
  const { updateServiceWorker } = useRegisterSW();

  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    release_date: string;
    changelog_ar: string[];
    changelog_en: string[];
  } | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'cashier' | 'manager'>('cashier');
  const [newPassword, setNewPassword] = useState('');
  const [empError, setEmpError] = useState('');
  const [empSuccess, setEmpSuccess] = useState('');
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [changePasswordVal, setChangePasswordVal] = useState('');
  
  const [isAutoBackup, setIsAutoBackup] = useState(() => localStorage.getItem('auto_backup_enabled') === 'true');
  const [autoBackupLocal, setAutoBackupLocal] = useState(() => localStorage.getItem('auto_backup_local') !== 'false');
  const [autoBackupDownloadFile, setAutoBackupDownloadFile] = useState(() => localStorage.getItem('auto_backup_download_file') === 'true');
  const [autoBackupInterval, setAutoBackupInterval] = useState(() => localStorage.getItem('auto_backup_interval') || '60');
  const [autoBackupOnExit, setAutoBackupOnExit] = useState(() => localStorage.getItem('auto_backup_on_exit') !== 'false');
  // Folder backup state
  const [folderBackupEnabled, setFolderBackupEnabledState] = useState(() => isFolderBackupEnabled());
  const [selectedFolderName, setSelectedFolderName] = useState(() => getSelectedFolderName());
  const [maxBackupsKeep, setMaxBackupsKeepState] = useState(() => getMaxBackupsToKeep());
  const folderSupported = isFolderBackupSupported();
  const [localBackups, setLocalBackups] = useState<LocalBackup[]>([]);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [localBackupStatus, setLocalBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [customGroqKey, setCustomGroqKey] = useState(() => localStorage.getItem('custom_groq_key') || '');
  const [showSettingsAiWarning, setShowSettingsAiWarning] = useState(() => {
    return !localStorage.getItem('custom_groq_key') && localStorage.getItem('dismiss_settings_ai_warning') !== 'true';
  });
  const [showInstructions, setShowInstructions] = useState(true);
  const [aiModel, setAiModel] = useState(() => {
    let saved = localStorage.getItem('ai_model') || 'llama-3.1-8b-instant';
    if (saved === 'llama3-8b-8192') {
      saved = 'llama-3.1-8b-instant';
      localStorage.setItem('ai_model', saved);
    } else if (saved === 'llama3-70b-8192') {
      saved = 'llama-3.3-70b-versatile';
      localStorage.setItem('ai_model', saved);
    }
    return saved;
  });
  const [aiEnabled, setAiEnabled] = useState(() => localStorage.getItem('ai_enabled') !== 'false');

  const [currencies, setCurrencies] = useState(getCurrenciesList);
  const [officialCurrency, setOfficialCurrencyState] = useState(getOfficialCurrency().code);
  const [helperCurrency, setHelperCurrencyState] = useState(() => getPOSHelperCurrency());
  const [exchangeRate, setExchangeRateState] = useState(() => getPOSExchangeRate());
  const [customCode, setCustomCode] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [currencySuccess, setCurrencySuccess] = useState<string | null>(null);

  // Print settings states
  const [shopName, setShopName] = useState(() => localStorage.getItem('receipt_shop_name') || '');
  const [shopPhone, setShopPhone] = useState(() => localStorage.getItem('receipt_shop_phone') || '');
  const [shopAddress, setShopAddress] = useState(() => localStorage.getItem('receipt_shop_address') || '');
  const [receiptFooter, setReceiptFooter] = useState(() => localStorage.getItem('receipt_footer') || '');
  const [printSuccess, setPrintSuccess] = useState<string | null>(null);

  // POS Shortcuts settings
  const [shortcutsG, setShortcutsG] = useState(() => localStorage.getItem('pos_shortcuts_g') || '50, 100, 250, 500');
  const [shortcutsKg, setShortcutsKg] = useState(() => localStorage.getItem('pos_shortcuts_kg') || '0.25, 0.5, 1, 2, 5');
  const [shortcutsPiece, setShortcutsPiece] = useState(() => localStorage.getItem('pos_shortcuts_piece') || '+2, +5, +10, +12');
  const [shortcutsSuccess, setShortcutsSuccess] = useState<string | null>(null);

  const saveShortcutsSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('pos_shortcuts_g', shortcutsG);
    localStorage.setItem('pos_shortcuts_kg', shortcutsKg);
    localStorage.setItem('pos_shortcuts_piece', shortcutsPiece);
    setShortcutsSuccess(isAr ? 'تم حفظ أزرار الكميات السريعة بنجاح' : 'Quantity shortcuts saved successfully');
    setTimeout(() => setShortcutsSuccess(null), 3000);
  };

  // License Request States
  const [sysConfig, setSysConfig] = useState<any>(null);
  const [reqDuration, setReqDuration] = useState<number>(3);
  const [reqPhone, setReqPhone] = useState<string>('');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);
  
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

  const handleSavePrintSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('receipt_shop_name', shopName);
    localStorage.setItem('receipt_shop_phone', shopPhone);
    localStorage.setItem('receipt_shop_address', shopAddress);
    localStorage.setItem('receipt_footer', receiptFooter);
    setPrintSuccess(t('print_settings_saved') || 'Print settings saved successfully');
    setTimeout(() => setPrintSuccess(null), 3000);
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateError(null);
    setUpdateStatusMsg(null);
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`);
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      
      const latestVersion = data.version;
      const isNewer = compareVersions(latestVersion, APP_VERSION) > 0;
      
      if (isNewer) {
        setUpdateInfo(data);
        setShowUpdateModal(true);
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.update().catch(() => {});
          }
        }
      } else {
        setUpdateStatusMsg(t('app_up_to_date'));
        setTimeout(() => setUpdateStatusMsg(null), 4000);
      }
    } catch (err) {
      console.error('Check update failed:', err);
      setUpdateError(t('update_connection_error'));
      setTimeout(() => setUpdateError(null), 5000);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const compareVersions = (v1: string, v2: string) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  };

  const handleOfficialCurrencyChange = (code: string) => {
    setOfficialCurrency(code);
    setOfficialCurrencyState(code);
    if (helperCurrency === code) {
      const newHelper = code === 'USD' ? 'IQD' : 'USD';
      setHelperCurrencyState(newHelper);
      setPOSHelperCurrency(newHelper);
    }
  };

  const handleHelperCurrencyChange = (code: string) => {
    setHelperCurrencyState(code);
    setPOSHelperCurrency(code);
  };

  const handleExchangeRateChange = (val: number) => {
    setExchangeRateState(val);
    setPOSExchangeRate(val);
  };

  const handleAddCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode || !customSymbol) return;
    const success = addCustomCurrency(customCode, customSymbol);
    if (success) {
      setCurrencies(getCurrenciesList());
      setCurrencySuccess(t('currency_added_success') || 'Currency added successfully!');
      setCurrencyError(null);
      setCustomCode('');
      setCustomSymbol('');
      setTimeout(() => setCurrencySuccess(null), 3000);
    } else {
      setCurrencyError(t('currency_exists') || 'Currency already exists!');
      setCurrencySuccess(null);
    }
  };

  const handleCustomKeyChange = (val: string) => {
    setCustomGroqKey(val);
    localStorage.setItem('custom_groq_key', val);
    if (val) {
      setShowSettingsAiWarning(false);
    } else {
      setShowSettingsAiWarning(localStorage.getItem('dismiss_settings_ai_warning') !== 'true');
    }
  };

  const handleModelChange = (val: string) => {
    setAiModel(val);
    localStorage.setItem('ai_model', val);
  };

  const toggleAutoBackup = () => {
    const newVal = !isAutoBackup;
    setIsAutoBackup(newVal);
    localStorage.setItem('auto_backup_enabled', newVal.toString());
  };

  const handleToggleAutoBackupLocal = (val: boolean) => {
    setAutoBackupLocal(val);
    localStorage.setItem('auto_backup_local', val.toString());
  };

  const handleToggleAutoBackupDownloadFile = (val: boolean) => {
    setAutoBackupDownloadFile(val);
    localStorage.setItem('auto_backup_download_file', val.toString());
  };

  const handleBackupIntervalChange = (val: string) => {
    setAutoBackupInterval(val);
    localStorage.setItem('auto_backup_interval', val);
  };

  const handleToggleAutoBackupOnExit = (val: boolean) => {
    setAutoBackupOnExit(val);
    localStorage.setItem('auto_backup_on_exit', val.toString());
  };

  const handlePickFolder = async () => {
    const folderName = await pickBackupFolder();
    if (folderName) {
      setSelectedFolderName(folderName);
      setFolderBackupEnabledState(true);
      setFolderBackupEnabled(true);
    }
  };

  const handleClearFolder = () => {
    clearFolderSelection();
    setSelectedFolderName(null);
    setFolderBackupEnabledState(false);
  };

  const handleToggleFolderBackup = (val: boolean) => {
    if (val && !selectedFolderName) {
      // Must pick a folder first
      handlePickFolder();
      return;
    }
    setFolderBackupEnabledState(val);
    setFolderBackupEnabled(val);
  };

  const handleMaxBackupsChange = (val: number) => {
    setMaxBackupsKeepState(val);
    setMaxBackupsToKeep(val);
  };

  const handleDeleteBackup = async (id: number) => {
    if (window.confirm(t('confirm_delete') || 'Are you sure you want to delete this backup?')) {
      await deleteLocalBackup(id);
      loadLocalBackupsList();
    }
  };

  const handleDownloadBackup = (backup: LocalBackup) => {
    const blob = new Blob([backup.data as BlobPart], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFromLocal = async (backup: LocalBackup) => {
    if (!window.confirm(t('confirm_restore_warn') || 'WARNING: This will overwrite all current local data with the backup file. Are you sure?')) {
      return;
    }

    try {
      setLocalBackupStatus('loading');

      const collections = ['products', 'units', 'invoices', 'debts', 'system_config', 'users', 'branches'];
      for (const colName of collections) {
        const docs = await db[colName].find().exec();
        for (const doc of docs) {
          await doc.remove();
        }
      }

      // unzipSync the backup data
      const unzipped = unzipSync(new Uint8Array(backup.data));
      const jsonUint8 = unzipped['smartmarket_backup.json'];
      if (!jsonUint8) {
        alert(t('invalid_backup_file') || 'Invalid backup file');
        setLocalBackupStatus('idle');
        return;
      }
      const jsonString = new TextDecoder().decode(jsonUint8);
      const dump = JSON.parse(jsonString);

      await db.importJSON(dump);

      alert(t('restore_success') || 'Database restored successfully!');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(t('restore_error') || 'Failed to restore database.');
      setLocalBackupStatus('error');
      setTimeout(() => setLocalBackupStatus('idle'), 3000);
    }
  };

  const handleLocalExport = async () => {
    setLocalBackupStatus('loading');
    try {
      const dump = await db.exportJSON();
      const uint8 = strToU8(JSON.stringify(dump));
      const zipped = zipSync({
        'smartmarket_backup.json': uint8
      });
      const blob = new Blob([zipped], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartmarket_backup_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setLocalBackupStatus('success');
      setTimeout(() => setLocalBackupStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setLocalBackupStatus('error');
      setTimeout(() => setLocalBackupStatus('idle'), 3000);
    }
  };

  const handleLocalRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const unzipped = unzipSync(new Uint8Array(buffer));
        const jsonUint8 = unzipped['smartmarket_backup.json'];
        if (!jsonUint8) {
          alert(t('invalid_backup_file') || 'Invalid backup file: smartmarket_backup.json not found in ZIP');
          return;
        }
        const jsonString = new TextDecoder().decode(jsonUint8);
        const dump = JSON.parse(jsonString);

        if (!window.confirm(t('confirm_restore_warn') || 'WARNING: This will overwrite all current local data with the backup file. Are you sure?')) {
          e.target.value = '';
          return;
        }

        setLocalBackupStatus('loading');

        const collections = ['products', 'units', 'invoices', 'debts', 'system_config', 'users', 'branches'];
        for (const colName of collections) {
          const docs = await db[colName].find().exec();
          for (const doc of docs) {
            await doc.remove();
          }
        }

        await db.importJSON(dump);

        setLocalBackupStatus('success');
        alert(t('restore_success') || 'Database restored successfully! The page will now reload.');
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert(t('restore_error') || 'Failed to restore database. Make sure the file is a valid SmartMarket backup ZIP.');
        setLocalBackupStatus('error');
        setTimeout(() => setLocalBackupStatus('idle'), 3000);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadLocalBackupsList = async () => {
    const list = await getLocalBackups();
    setLocalBackups(list);
  };



  const loadEmployees = async () => {
    if (!db) return;
    try {
      const docs = await db.users.find().exec();
      setEmployees(docs.map(d => d.toJSON()));
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError('');
    setEmpSuccess('');

    if (!newUsername || !newDisplayName || !newPassword) return;
    if (newPassword.length < 6) {
      setEmpError(t('password_too_short') || 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    const usernameClean = newUsername.toLowerCase().trim();
    const exists = employees.some(emp => emp.username === usernameClean);
    if (exists) {
      setEmpError(t('username_exists') || 'اسم المستخدم موجود بالفعل');
      return;
    }

    try {
      const newSalt = generateSalt();
      const pwdHash = await secureHashPassword(newPassword, newSalt);
      const userId = 'user-' + Math.random().toString(36).substring(2, 11);
      await db.users.insert({
        user_id: userId,
        username: usernameClean,
        password_hash: pwdHash,
        password_salt: newSalt,
        display_name: newDisplayName,
        role: newRole,
        branch_id: '',
        created_at: new Date().toISOString(),
        is_active: true
      });

      setEmpSuccess(t('employee_added_success') || 'تم إضافة الموظف بنجاح!');
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      await loadEmployees();
    } catch (err) {
      console.error(err);
      setEmpError(t('employee_add_failed') || 'فشل إضافة الموظف');
    }
  };

  const handleToggleUserActive = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUser?.user_id) {
      alert(t('cannot_disable_self') || 'لا يمكنك تعطيل حسابك الحالي!');
      return;
    }
    try {
      const userDoc = await db.users.findOne(userId).exec();
      if (userDoc) {
        await userDoc.incrementalPatch({ is_active: !currentStatus });
        await loadEmployees();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeUserPassword = async (userId: string) => {
    if (!changePasswordVal || changePasswordVal.length < 6) {
      alert(t('password_too_short') || 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    try {
      const userDoc = await db.users.findOne(userId).exec();
      if (userDoc) {
        const newSalt = generateSalt();
        const newHash = await secureHashPassword(changePasswordVal, newSalt);
        await userDoc.incrementalPatch({
          password_hash: newHash,
          password_salt: newSalt
        });
        alert(t('password_changed_success') || 'تم تغيير كلمة المرور بنجاح!');
        setEditingPasswordUserId(null);
        setChangePasswordVal('');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to change password');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (username === 'admin') {
      alert(t('cannot_delete_default_admin') || 'لا يمكن حذف حساب الأدمن الرئيسي!');
      return;
    }
    if (userId === currentUser?.user_id) {
      alert(t('cannot_delete_self') || 'لا يمكنك حذف حسابك الحالي!');
      return;
    }
    if (!window.confirm(t('confirm_delete_user') || `هل أنت متأكد من حذف حساب الموظف ${username} نهائياً؟`)) {
      return;
    }
    try {
      const userDoc = await db.users.findOne(userId).exec();
      if (userDoc) {
        await userDoc.remove();
        await loadEmployees();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadLocalBackupsList();
    if (isAdmin) {
      loadEmployees();
    }
    
    const handleBackupCompleted = () => {
      loadLocalBackupsList();
    };
    window.addEventListener('auto_backup_completed', handleBackupCompleted);
    return () => {
      window.removeEventListener('auto_backup_completed', handleBackupCompleted);
    };
  }, [isAdmin]);

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
          merchant_name: shopName || 'عميل (بدون اسم)',
          phone: reqPhone,
          duration_months: reqDuration,
          current_license_key: sysConfig.license_key || 'trial'
        })
      });
      if (res.ok) {
        setReqSuccess(isAr ? 'تم إرسال الطلب بنجاح!' : 'Request sent successfully!');
        
        // Open WhatsApp
        const msg = isAr 
          ? `مرحباً، أود طلب تمديد/ترقية اشتراكي في نظام إدارة المبيعات لمدة ${reqDuration} أشهر.\n\nالاسم: ${shopName || 'عميل'}\nالهاتف: ${reqPhone}\nالمعرف: ${sysConfig.hardware_fingerprint || 'غير متوفر'}\nالترخيص الحالي: ${sysConfig.license_key || 'فترة تجريبية'}`
          : `Hello, I would like to request a subscription extension for ${reqDuration} months.\n\nName: ${shopName || 'Customer'}\nPhone: ${reqPhone}\nID: ${sysConfig.hardware_fingerprint || 'N/A'}\nCurrent License: ${sysConfig.license_key || 'Trial'}`;
        
        const encodedMsg = encodeURIComponent(msg);
        // Using a generic WhatsApp link that lets the user choose who to send to if we don't know the owner's number,
        // but typically they send to the owner. We can use wa.me/?text=
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
      const isDemoLoginEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false';
      
      if (isDemoLoginEnabled && isDemoBypassKey) {
          const fullTokenPayload = JSON.stringify({ license_key: activationKey, hw_fingerprint: hwFingerprint });
          const encryptedToken = await encryptData(fullTokenPayload, hwFingerprint);
          const configDoc = await db.system_config.findOne('config').exec();
          if (configDoc) {
              await configDoc.incrementalPatch({ 
                license_key: activationKey, 
                activation_status: true, 
                offline_grace_days_left: 5,
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
                offline_grace_days_left: 5,
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
    <div className="max-w-3xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold">{t('settings')}</h2>

      {/* Auto-Backup Settings Card */}
      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
            <HardDrive className="text-[var(--color-primary)]" size={28} />
            <h3 className="text-xl font-semibold">{t('auto_backup')}</h3>
        </div>

        <div className="space-y-6">
            {/* Auto-Backup Main Toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-medium text-lg">{t('auto_backup')}</h4>
                    <p className="text-sm text-gray-500">{t('auto_backup_desc')}</p>
                </div>
                <button 
                    onClick={toggleAutoBackup}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAutoBackup ? 'bg-[var(--color-primary)]' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAutoBackup ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {/* Sub-settings for Auto-Backup (only show if auto backup is enabled) */}
            {isAutoBackup && (
                <div className="p-4 bg-black/5 dark:bg-white/5 rounded-xl space-y-4 border border-black/5 dark:border-white/5">
                    {/* Targets Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">{t('backup_targets')}</label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    checked={autoBackupLocal}
                                    onChange={(e) => handleToggleAutoBackupLocal(e.target.checked)}
                                    className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4"
                                />
                                <span>{t('backup_target_local')}</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    checked={autoBackupDownloadFile}
                                    onChange={(e) => handleToggleAutoBackupDownloadFile(e.target.checked)}
                                    className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4"
                                />
                                <span>{t('backup_target_download')}</span>
                            </label>

                            {/* Folder backup target */}
                            {folderSupported ? (
                              <label className="flex items-center gap-3 cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    checked={folderBackupEnabled}
                                    onChange={(e) => handleToggleFolderBackup(e.target.checked)}
                                    className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4"
                                />
                                <span>{t('backup_target_folder')}</span>
                              </label>
                            ) : (
                              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
                                ⚠️ {t('folder_not_supported')}
                              </p>
                            )}
                        </div>
                    </div>

                    {/* Interval Selection */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('backup_interval')}</label>
                        <select
                            value={autoBackupInterval}
                            onChange={(e) => handleBackupIntervalChange(e.target.value)}
                            className="p-2 rounded-lg bg-white dark:bg-[#16171d] border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer text-sm w-full sm:w-64"
                        >
                            <option value="5">{t('interval_5m') || '5 دقائق'}</option>
                            <option value="10">{t('interval_10m') || '10 دقائق'}</option>
                            <option value="15">{t('interval_15m')}</option>
                            <option value="30">{t('interval_30m')}</option>
                            <option value="60">{t('interval_1h')}</option>
                            <option value="180">{t('interval_3h')}</option>
                            <option value="360">{t('interval_6h')}</option>
                            <option value="720">{t('interval_12h')}</option>
                            <option value="1440">{t('interval_24h')}</option>
                        </select>
                    </div>

                    {/* Folder Backup Panel — shown when folder target is enabled or folder is already selected */}
                    {folderSupported && (folderBackupEnabled || selectedFolderName) && (
                        <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-3">
                            <div className="flex items-center gap-2">
                                <FolderOpen size={18} className="text-purple-500" />
                                <h4 className="font-semibold text-sm">{t('folder_backup_section')}</h4>
                            </div>

                            <p className="text-xs text-gray-500">{t('folder_backup_desc')}</p>

                            {/* Current folder name */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex-1 px-3 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-mono truncate">
                                    {selectedFolderName
                                        ? `📁 ${selectedFolderName}`
                                        : <span className="text-gray-400">{t('no_folder_selected')}</span>
                                    }
                                </div>
                                <button
                                    type="button"
                                    onClick={handlePickFolder}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                >
                                    <FolderOpen size={14} />
                                    {selectedFolderName ? t('change_folder_btn') : t('select_folder_btn')}
                                </button>
                                {selectedFolderName && (
                                    <button
                                        type="button"
                                        onClick={handleClearFolder}
                                        className="flex items-center gap-1.5 px-3 py-2 border border-red-400 text-red-500 text-sm font-medium rounded-lg hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                    >
                                        <FolderX size={14} />
                                        {t('clear_folder_btn')}
                                    </button>
                                )}
                            </div>

                            {/* Max backups to keep */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {t('max_backups_keep')}:
                                </label>
                                <select
                                    value={maxBackupsKeep}
                                    onChange={(e) => handleMaxBackupsChange(Number(e.target.value))}
                                    className="p-1.5 rounded-lg bg-white dark:bg-[#16171d] border border-black/10 dark:border-white/10 text-sm cursor-pointer"
                                >
                                    <option value={3}>3</option>
                                    <option value={5}>5</option>
                                    <option value={7}>7</option>
                                    <option value={10}>10</option>
                                    <option value={15}>15</option>
                                    <option value={20}>20</option>
                                </select>
                            </div>

                            {/* Google Drive tip */}
                            <div className="text-xs text-purple-700 dark:text-purple-300 bg-purple-500/10 px-3 py-2 rounded-lg">
                                {t('folder_backup_tip')}
                            </div>

                            {/* Permission note */}
                            <p className="text-xs text-gray-400">
                                🔒 {t('folder_backup_permission_note')}
                            </p>
                        </div>
                    )}

                    {/* Exit/Close Selection */}
                    <label className="flex items-center gap-3 cursor-pointer text-sm pt-2 border-t border-black/5 dark:border-white/5">
                        <input 
                            type="checkbox"
                            checked={autoBackupOnExit}
                            onChange={(e) => handleToggleAutoBackupOnExit(e.target.checked)}
                            className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4"
                        />
                        <span>{t('backup_on_exit')}</span>
                    </label>
                </div>
            )}

            {/* Manual Trigger for Auto Backup Now */}
            {isAutoBackup && (
                <div className="pt-4 flex items-center justify-between border-t border-black/5 dark:border-white/5">
                    <div>
                        <h4 className="font-medium text-sm">{t('manual_backup') || 'تشغيل فوري'}</h4>
                        <p className="text-xs text-gray-500">
                            {localStorage.getItem('auto_backup_last_time') 
                                ? t('last_backup', { time: new Date(localStorage.getItem('auto_backup_last_time') || '').toLocaleString() }) 
                                : t('never_backed_up')}
                        </p>
                    </div>
                    <button 
                        onClick={async () => {
                            setBackupStatus('loading');
                            await runAutoBackup(db);
                            setBackupStatus('success');
                            setTimeout(() => setBackupStatus('idle'), 3000);
                        }}
                        disabled={backupStatus === 'loading'}
                        className="flex items-center gap-2 px-5 py-2 border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 font-medium rounded-lg active:scale-95 disabled:opacity-50 transition-all cursor-pointer text-sm"
                    >
                        {backupStatus === 'loading' ? (
                            <><RefreshCcw size={16} className="animate-spin" /> {t('backing_up')}</>
                        ) : (
                            <><RefreshCcw size={16} /> {t('backup_now')}</>
                        )}
                    </button>
                </div>
            )}

            {backupStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-600 bg-green-500/10 p-3 rounded-lg font-medium text-sm">
                    <CheckCircle size={16} /> {t('backup_success')}
                </div>
            )}

            {backupStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 bg-red-500/10 p-3 rounded-lg font-medium text-sm">
                    <AlertCircle size={16} /> {t('backup_error')}
                </div>
            )}

            {/* Local IndexedDB Backups History List */}
            {localBackups.length > 0 && (
                <div className="pt-6 border-t border-black/5 dark:border-white/5 space-y-3">
                    <h4 className="font-semibold text-sm">{t('local_saved_backups')}</h4>
                    <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
                        <table className="w-full text-sm text-left dir-auto">
                            <thead className="bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-medium border-b border-black/10 dark:border-white/10">
                                <tr>
                                    <th className="p-3">{t('date') || 'التاريخ'}</th>
                                    <th className="p-3">{t('file_size') || 'الحجم'}</th>
                                    <th className="p-3 text-center">{t('actions') || 'الإجراءات'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {localBackups.map((backup) => (
                                    <tr key={backup.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-3 font-mono text-xs">
                                            {new Date(backup.timestamp).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-xs">
                                            {t('size_kb', { size: (backup.size / 1024).toFixed(1) })}
                                        </td>
                                        <td className="p-3 flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleDownloadBackup(backup)}
                                                className="p-1 text-purple-600 hover:bg-purple-600/10 rounded transition-colors"
                                                title={t('download_btn')}
                                            >
                                                <Download size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleRestoreFromLocal(backup)}
                                                className="p-1 text-green-600 hover:bg-green-600/10 rounded transition-colors"
                                                title={t('restore_btn') || 'استعادة'}
                                            >
                                                <Play size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBackup(backup.id!)}
                                                className="p-1 text-red-600 hover:bg-red-600/10 rounded transition-colors"
                                                title={t('delete_btn')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Local Offline Backup Card */}
      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10 mt-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
            <Download className="text-[var(--color-primary)]" size={28} />
            <h3 className="text-xl font-semibold">{t('local_backup_title')}</h3>
        </div>

        <div className="space-y-6">
            <div>
                <p className="text-sm text-gray-500 mb-4">{t('local_backup_desc')}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-black/5 dark:border-white/5">
                <button 
                    onClick={handleLocalExport}
                    disabled={localBackupStatus === 'loading'}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-semibold rounded-xl active:scale-95 disabled:opacity-50 transition-all cursor-pointer text-center"
                >
                    <Download size={18} /> {t('export_backup_btn')}
                </button>

                <div className="flex-1 relative">
                    <input 
                        type="file" 
                        accept=".zip" 
                        id="local-restore-file"
                        onChange={handleLocalRestore}
                        className="hidden" 
                    />
                    <label 
                        htmlFor="local-restore-file"
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-500/15 hover:bg-green-500/25 text-green-600 dark:text-green-400 font-semibold rounded-xl active:scale-95 cursor-pointer text-center"
                    >
                        <Upload size={18} /> {t('import_backup_btn')}
                    </label>
                </div>
            </div>

            {localBackupStatus === 'loading' && (
                <div className="flex items-center gap-2 text-[var(--color-primary)] bg-[var(--color-primary)]/10 p-3 rounded-lg font-medium">
                    <RefreshCcw size={18} className="animate-spin" /> {t('processing') || 'Processing...'}
                </div>
            )}
            {localBackupStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-600 bg-green-500/10 p-3 rounded-lg font-medium">
                    <CheckCircle size={18} /> {t('backup_success')}
                </div>
            )}
            {localBackupStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 bg-red-500/10 p-3 rounded-lg font-medium">
                    <AlertCircle size={18} /> {t('backup_error')}
                </div>
            )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10 mt-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
            <h3 className="text-xl font-semibold flex items-center gap-2">{t('ai_diagnostic_module')}</h3>
        </div>

        <div className="flex items-center justify-between">
            <div>
                <h4 className="font-medium text-lg">{t('enable_groq_ai')}</h4>
                <p className="text-sm text-gray-500">{t('enable_groq_ai_desc')}</p>
            </div>
            <button 
                onClick={() => {
                  const nextVal = !aiEnabled;
                  setAiEnabled(nextVal);
                  localStorage.setItem('ai_enabled', nextVal.toString());
                  window.dispatchEvent(new Event('storage')); // trigger update
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${aiEnabled ? 'bg-[var(--color-primary)]' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>

        {aiEnabled && (
          <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Shared Server Warning Alert (dismissible) */}
            {showSettingsAiWarning && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start justify-between gap-3 text-orange-800 dark:text-orange-300 text-sm animate-in fade-in slide-in-from-top duration-200">
                <div className="flex-1 flex items-start gap-2.5">
                  <AlertCircle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{t('settings_ai_warning')}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowSettingsAiWarning(false);
                    localStorage.setItem('dismiss_settings_ai_warning', 'true');
                  }}
                  className="p-1 hover:bg-orange-500/20 rounded-lg transition-colors cursor-pointer text-orange-500 flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Collapsible Instruction Guide to Get API Key */}
            <div className="border border-black/5 dark:border-white/5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden">
              <button 
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-between p-4 font-medium text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <BookOpen size={16} className="text-[var(--color-primary)]" />
                  {t('instructions_title')}
                </span>
                <span className="text-xs text-gray-500">{showInstructions ? '▲ إخفاء' : '▼ عرض التفاصيل'}</span>
              </button>
              
              {showInstructions && (
                <div className="p-4 pt-0 border-t border-black/5 dark:border-white/5 space-y-2 text-xs text-gray-600 dark:text-gray-400 bg-white/40 dark:bg-black/10 transition-all animate-in fade-in duration-200">
                  <p>{t('instruction_step_1')}</p>
                  <p>{t('instruction_step_2')}</p>
                  <p>{t('instruction_step_3')}</p>
                  <p>{t('instruction_step_4')}</p>
                  <p>{t('instruction_step_5')}</p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">{t('custom_groq_key')}</label>
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1">
                  <Info size={12} />
                  {t('get_groq_key') || 'Get API Key'}
                </a>
              </div>
              <input 
                type="password"
                value={customGroqKey}
                onChange={(e) => handleCustomKeyChange(e.target.value)}
                placeholder={t('custom_groq_key_placeholder')}
                className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('ai_model_label')}</label>
              <select 
                value={aiModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer transition-all"
              >
                <option value="llama-3.1-8b-instant">Llama 3.1 8B (llama-3.1-8b-instant)</option>
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B (llama-3.3-70b-versatile) - VIP</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Currency Settings Card */}
      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
            <Coins className="text-[var(--color-primary)]" size={28} />
            <h3 className="text-xl font-semibold">{t('currency_settings')}</h3>
        </div>

        <div className="space-y-6">
            {/* Select Official Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                    <h4 className="font-medium text-lg">{t('official_currency')}</h4>
                    <p className="text-sm text-gray-500">{t('official_currency_desc')}</p>
                </div>
                <select 
                    value={officialCurrency}
                    onChange={(e) => handleOfficialCurrencyChange(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer transition-all font-medium"
                >
                    {currencies.map(c => (
                        <option key={c.code} value={c.code}>
                            {c.code} ({c.symbol})
                        </option>
                    ))}
                </select>
            </div>

            {/* Select Helper Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-4 border-t border-black/5 dark:border-white/5">
                <div>
                    <h4 className="font-medium text-lg">{t('default_helper_currency')}</h4>
                    <p className="text-sm text-gray-500">{t('default_helper_currency_desc')}</p>
                </div>
                <select 
                    value={helperCurrency}
                    onChange={(e) => handleHelperCurrencyChange(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer transition-all font-medium"
                >
                    {currencies
                      .filter(c => c.code !== officialCurrency)
                      .map(c => (
                        <option key={c.code} value={c.code}>
                            {c.code} ({c.symbol})
                        </option>
                    ))}
                </select>
            </div>

            {/* Default Exchange Rate Helper */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-4 border-t border-black/5 dark:border-white/5">
                <div>
                    <h4 className="font-medium text-lg">{t('default_exchange_rate')}</h4>
                    <p className="text-sm text-gray-500">{t('default_exchange_rate_desc')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">1 {helperCurrency} =</span>
                    <input 
                        type="number"
                        min="0"
                        step="0.000001"
                        value={exchangeRate || ''}
                        onChange={(e) => handleExchangeRateChange(Number(e.target.value))}
                        className="flex-1 px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-mono"
                    />
                    <span className="font-mono text-sm">{currencies.find(c => c.code === officialCurrency)?.symbol || officialCurrency}</span>
                </div>
            </div>

            {/* Add Custom Currency Form */}
            <div className="pt-6 border-t border-black/5 dark:border-white/5">
                <h4 className="font-medium text-lg mb-4">{t('add_custom_currency')}</h4>
                <form onSubmit={handleAddCurrency} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('currency_code')}</label>
                        <input 
                            type="text"
                            required
                            value={customCode}
                            onChange={(e) => setCustomCode(e.target.value)}
                            placeholder="e.g. SYP"
                            className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all uppercase"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('currency_symbol')}</label>
                        <input 
                            type="text"
                            required
                            value={customSymbol}
                            onChange={(e) => setCustomSymbol(e.target.value)}
                            placeholder="e.g. ل.س"
                            className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>
                    <button 
                        type="submit"
                        className="w-full py-2 px-6 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-semibold rounded-lg transition-all active:scale-95 cursor-pointer"
                    >
                        {t('add')}
                    </button>
                </form>
                {currencySuccess && (
                    <div className="mt-3 text-sm text-green-600 bg-green-500/10 p-2.5 rounded-lg font-medium animate-in fade-in duration-200">
                        {currencySuccess}
                    </div>
                )}
                {currencyError && (
                    <div className="mt-3 text-sm text-red-600 bg-red-500/10 p-2.5 rounded-lg font-medium animate-in fade-in duration-200">
                        {currencyError}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Invoice & Print Settings Card */}
      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10 mt-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
            <Printer className="text-[var(--color-primary)]" size={28} />
            <h3 className="text-xl font-semibold">{t('invoice_settings')}</h3>
        </div>

        <form onSubmit={handleSavePrintSettings} className="space-y-6">
            {/* Shop Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
                <div>
                    <label className="block text-sm font-medium mb-1">{t('shop_name')}</label>
                    <input 
                        type="text"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder={t('app_name')}
                        className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">{t('shop_phone')}</label>
                    <input 
                        type="text"
                        value={shopPhone}
                        onChange={(e) => setShopPhone(e.target.value)}
                        placeholder="e.g. +964 770 000 0000"
                        className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">{t('shop_address')}</label>
                    <input 
                        type="text"
                        value={shopAddress}
                        onChange={(e) => setShopAddress(e.target.value)}
                        placeholder="e.g. Baghdad, Iraq"
                        className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">{t('receipt_footer')}</label>
                    <textarea 
                        value={receiptFooter}
                        onChange={(e) => setReceiptFooter(e.target.value)}
                        placeholder="e.g. شكراً لزيارتكم! / Thank you for shopping!"
                        rows={2}
                        className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all resize-none"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-black/5 dark:border-white/5">
                <button 
                    type="submit"
                    className="px-6 py-2 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                    {t('save')}
                </button>
            </div>

            {printSuccess && (
                <div className="text-sm text-green-600 bg-green-500/10 p-2.5 rounded-lg font-medium animate-in fade-in duration-200">
                    {printSuccess}
                </div>
            )}
        </form>
      </div>

      {/* POS Shortcuts Settings Card */}
      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10 mt-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
            <span className="text-[var(--color-primary)] p-2 bg-purple-500/10 rounded-xl">
               <svg xmlns="http://www.w3.org/-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h16"/><path d="M4 14h16"/><path d="M4 6h16"/><path d="M4 18h16"/></svg>
            </span>
            <h3 className="text-xl font-semibold">{isAr ? 'أزرار الكميات السريعة (POS)' : 'POS Quantity Shortcuts'}</h3>
        </div>

        <form onSubmit={saveShortcutsSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
                <div>
                    <label className="block text-sm font-medium mb-1">{isAr ? 'اختصارات الغرام (g)' : 'Gram (g) Shortcuts'}</label>
                    <input 
                        type="text"
                        value={shortcutsG}
                        onChange={(e) => setShortcutsG(e.target.value)}
                        placeholder="50, 100, 250, 500"
                        className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all dir-ltr"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">{isAr ? 'افصل بين الأرقام بفاصلة' : 'Comma separated values'}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">{isAr ? 'اختصارات الكيلو (kg)' : 'Kilo (kg) Shortcuts'}</label>
                    <input 
                        type="text"
                        value={shortcutsKg}
                        onChange={(e) => setShortcutsKg(e.target.value)}
                        placeholder="0.25, 0.5, 1, 2, 5"
                        className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all dir-ltr"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">{isAr ? 'مثال للكسور: 0.25' : 'Example fractions: 0.25'}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">{isAr ? 'اختصارات الوحدات الأخرى' : 'Other Units Shortcuts'}</label>
                    <input 
                        type="text"
                        value={shortcutsPiece}
                        onChange={(e) => setShortcutsPiece(e.target.value)}
                        placeholder="+2, +5, +10, +12"
                        className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all dir-ltr"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">{isAr ? 'استخدم + للزيادة بدلاً من الاستبدال' : 'Use + to add instead of replace'}</p>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-black/5 dark:border-white/5">
                <button 
                    type="submit"
                    className="px-6 py-2 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                    {t('save')}
                </button>
            </div>

            {shortcutsSuccess && (
                <div className="text-sm text-green-600 bg-green-500/10 p-2.5 rounded-lg font-medium animate-in fade-in duration-200">
                    {shortcutsSuccess}
                </div>
            )}
        </form>
      </div>

      {/* Subscription Request Card */}
      {isAdmin && sysConfig && (
        <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10 mt-8">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
              <ShieldCheck className="text-[var(--color-primary)]" size={28} />
              <h3 className="text-xl font-semibold">{isAr ? 'الاشتراك والترخيص' : 'Subscription & License'}</h3>
          </div>

          <div className="space-y-6">
            <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <p className="text-sm font-semibold opacity-70 mb-1">{isAr ? 'حالة الترخيص الحالي:' : 'Current License:'}</p>
                <p className="font-mono font-bold text-lg text-[var(--color-primary)]">
                  {sysConfig.license_key || (isAr ? 'فترة تجريبية' : 'Trial Version')}
                </p>
                <p className="text-xs text-gray-500 mt-1">ID: {sysConfig.hardware_fingerprint}</p>
              </div>
            </div>

            {/* Manual Activation */}
            <div className="pt-4 border-t border-black/5 dark:border-white/5">
                <h4 className="font-medium text-lg mb-2">{isAr ? 'إدخال مفتاح التفعيل / تمديد الاشتراك' : 'Enter Activation Key / Extend Subscription'}</h4>
                <p className="text-sm text-gray-500 mb-4">
                  {isAr ? 'إذا حصلت على مفتاح تفعيل جديد، قم بإدخاله هنا لتحديث حالة اشتراكك فوراً.' : 'If you received a new activation key, enter it here to update your subscription instantly.'}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 w-full">
                    <input 
                      type="text"
                      value={activationKey}
                      onChange={(e) => setActivationKey(e.target.value)}
                      placeholder={isAr ? "مثال: SM-XXXX-XXXX" : "e.g. SM-XXXX-XXXX"}
                      className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-mono dir-ltr text-center"
                    />
                    {activationError && <p className="text-red-500 text-sm font-semibold mt-2">{activationError}</p>}
                    {activationSuccess && <p className="text-green-600 dark:text-green-400 text-sm font-semibold mt-2">{activationSuccess}</p>}
                  </div>
                  <button 
                    onClick={handleActivateLicense}
                    disabled={activationLoading}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[var(--color-primary)] hover:brightness-110 disabled:opacity-50 text-white font-bold rounded-lg transition-all cursor-pointer shadow-md"
                  >
                    {activationLoading ? (isAr ? 'جاري التحقق...' : 'Verifying...') : (isAr ? 'تفعيل الآن' : 'Activate Now')}
                  </button>
                </div>
            </div>

            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <h4 className="font-medium text-lg mb-2">{isAr ? 'طلب تمديد أو ترقية الاشتراك' : 'Request Extension / Upgrade'}</h4>
              <p className="text-sm text-gray-500 mb-4">
                {isAr ? 'يمكنك إرسال طلب للمطور لتمديد أو تفعيل اشتراكك السحابي.' : 'Send a request to the developer to extend or activate your cloud subscription.'}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="w-full sm:w-1/3">
                  <label className="block text-sm font-medium mb-1">{isAr ? 'مدة التمديد المطلوبة' : 'Requested Duration'}</label>
                  <select 
                    value={reqDuration}
                    onChange={(e) => setReqDuration(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer transition-all"
                  >
                    <option value={1}>{isAr ? 'شهر واحد' : '1 Month'}</option>
                    <option value={3}>{isAr ? '3 أشهر' : '3 Months'}</option>
                    <option value={6}>{isAr ? '6 أشهر' : '6 Months'}</option>
                    <option value={12}>{isAr ? 'سنة كاملة' : '1 Year'}</option>
                  </select>
                </div>
                <div className="w-full sm:w-1/3">
                  <label className="block text-sm font-medium mb-1">{isAr ? 'رقم الهاتف (للتواصل)' : 'Phone Number'}</label>
                  <input 
                    type="tel"
                    required
                    value={reqPhone}
                    onChange={(e) => setReqPhone(e.target.value)}
                    placeholder="e.g. 05XXXXX"
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={handleRequestExtension}
                  disabled={reqLoading}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  {reqLoading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال الطلب الآن' : 'Send Request')}
                </button>
              </div>
              
              {reqSuccess && (
                <div className="mt-4 p-3 bg-green-500/10 text-green-600 rounded-lg text-sm font-bold flex items-center gap-2">
                  <CheckCircle size={18} />
                  {reqSuccess}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Employee Management Card */}
      {isAdmin && (
        <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10 mt-8 space-y-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
              <UserCheck className="text-[var(--color-primary)]" size={28} />
              <h3 className="text-xl font-semibold">{t('manage_employees') || 'إدارة الموظفين والورديات'}</h3>
          </div>

          {/* Add Employee Form */}
          <div className="p-4 bg-black/5 dark:bg-white/5 rounded-xl space-y-4 border border-black/5 dark:border-white/5">
              <h4 className="font-semibold text-base">{t('add_new_employee') || 'إضافة موظف جديد'}</h4>
              <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div>
                      <label className="block text-xs font-medium mb-1">{t('display_name_label') || 'الاسم الكامل'}</label>
                      <input 
                          type="text"
                          required
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          placeholder="e.g. محمد علي"
                          className="w-full px-4 py-2 rounded-lg bg-white dark:bg-[#16171d] border border-black/10 dark:border-white/10 outline-none text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-medium mb-1">{t('username_label') || 'اسم المستخدم (لتسجيل الدخول)'}</label>
                      <input 
                          type="text"
                          required
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="e.g. mohamed"
                          className="w-full px-4 py-2 rounded-lg bg-white dark:bg-[#16171d] border border-black/10 dark:border-white/10 outline-none text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-medium mb-1">{t('role') || 'الدور'}</label>
                      <select 
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as any)}
                          className="w-full px-4 py-2 rounded-lg bg-white dark:bg-[#16171d] border border-black/10 dark:border-white/10 outline-none text-sm cursor-pointer"
                      >
                          <option value="cashier">{t('role_cashier') || 'كاشير'}</option>
                          <option value="manager">{t('role_manager') || 'مدير'}</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs font-medium mb-1">{t('password') || 'كلمة المرور'}</label>
                      <input 
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="******"
                          className="w-full px-4 py-2 rounded-lg bg-white dark:bg-[#16171d] border border-black/10 dark:border-white/10 outline-none text-sm"
                      />
                  </div>
                  <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                      <button 
                          type="submit"
                          className="px-6 py-2 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:brightness-110 active:scale-95 transition-all text-sm cursor-pointer"
                      >
                          {t('add_employee_btn') || 'إضافة موظف'}
                      </button>
                  </div>
              </form>
              {empSuccess && (
                  <div className="text-sm text-green-600 bg-green-500/10 p-2.5 rounded-lg font-medium">
                      {empSuccess}
                  </div>
              )}
              {empError && (
                  <div className="text-sm text-red-600 bg-red-500/10 p-2.5 rounded-lg font-medium">
                      {empError}
                  </div>
              )}
          </div>

          {/* List of current employees */}
          <div className="space-y-3">
              <h4 className="font-semibold text-base">{t('current_employees') || 'الموظفون الحاليون'}</h4>
              <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
                  <table className="w-full text-sm text-right">
                      <thead className="bg-black/5 dark:bg-white/5 text-xs uppercase border-b border-black/10 dark:border-white/10">
                          <tr>
                              <th scope="col" className="px-4 py-3">{t('display_name_label') || 'الاسم الكامل'}</th>
                              <th scope="col" className="px-4 py-3">{t('username_label') || 'اسم المستخدم'}</th>
                              <th scope="col" className="px-4 py-3">{t('role') || 'الدور'}</th>
                              <th scope="col" className="px-4 py-3 text-center">{t('status') || 'الحالة'}</th>
                              <th scope="col" className="px-4 py-3 text-center">{t('actions') || 'إجراءات'}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                          {employees.map((emp) => (
                              <tr key={emp.user_id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                                  <td className="px-4 py-3 font-semibold">{emp.display_name}</td>
                                  <td className="px-4 py-3 font-mono text-xs">{emp.username}</td>
                                  <td className="px-4 py-3 text-xs">
                                      {emp.role === 'admin' ? (t('role_admin') || 'أدمن') : emp.role === 'manager' ? (t('role_manager') || 'مدير') : (t('role_cashier') || 'كاشير')}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <button
                                          onClick={() => handleToggleUserActive(emp.user_id, emp.is_active)}
                                          disabled={emp.user_id === currentUser?.user_id}
                                          className={`px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 cursor-pointer ${
                                              emp.is_active 
                                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                          }`}
                                      >
                                          {emp.is_active ? (t('active') || 'نشط') : (t('disabled') || 'معطل')}
                                      </button>
                                  </td>
                                  <td className="px-4 py-3 text-center text-xs">
                                      <div className="flex items-center justify-center gap-3">
                                          {editingPasswordUserId === emp.user_id ? (
                                              <div className="flex items-center gap-2">
                                                  <input 
                                                      type="password"
                                                      value={changePasswordVal}
                                                      onChange={(e) => setChangePasswordVal(e.target.value)}
                                                      placeholder="New password"
                                                      className="px-2 py-1 text-xs rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none w-28"
                                                  />
                                                  <button
                                                      onClick={() => handleChangeUserPassword(emp.user_id)}
                                                      className="text-green-600 font-bold hover:underline"
                                                  >
                                                      {t('save') || 'حفظ'}
                                                  </button>
                                                  <button
                                                      onClick={() => { setEditingPasswordUserId(null); setChangePasswordVal(''); }}
                                                      className="text-gray-500 hover:underline"
                                                  >
                                                      {t('cancel') || 'إلغاء'}
                                                  </button>
                                              </div>
                                          ) : (
                                              <button
                                                  onClick={() => setEditingPasswordUserId(emp.user_id)}
                                                  className="text-[var(--color-primary)] hover:underline"
                                              >
                                                  🔑 {t('change_password') || 'تغيير كلمة المرور'}
                                              </button>
                                          )}
                                          {emp.username !== 'admin' && emp.user_id !== currentUser?.user_id && (
                                              <button
                                                  onClick={() => handleDeleteUser(emp.user_id, emp.username)}
                                                  className="text-red-500 hover:underline"
                                              >
                                                  ❌ {t('delete') || 'حذف'}
                                              </button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
        </div>
      )}

      {/* System Update Card */}
      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
          <ArrowUpCircle className="text-[var(--color-primary)]" size={28} />
          <h3 className="text-xl font-semibold">{t('system_update')}</h3>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 className="font-medium text-lg">{t('check_updates')}</h4>
            <p className="text-sm text-gray-500 mt-1">
              {t('current_version')}: <span className="font-mono font-semibold bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">{APP_VERSION}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleCheckForUpdates}
              disabled={checkingUpdates}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer w-full sm:w-auto"
            >
              {checkingUpdates ? (
                <>
                  <RefreshCcw size={16} className="animate-spin" />
                  {t('checking_updates')}
                </>
              ) : (
                t('check_updates')
              )}
            </button>
          </div>
        </div>

        {updateStatusMsg && (
          <div className="mt-4 p-3 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded-xl text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <span>✅</span>
            <span>{updateStatusMsg}</span>
          </div>
        )}

        {updateError && (
          <div className="mt-4 p-3 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <span>⚠️</span>
            <span>{updateError}</span>
          </div>
        )}
      </div>

      {/* Update Changelog Modal */}
      {showUpdateModal && updateInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-lg shadow-2xl border border-black/10 dark:border-white/10 p-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-black/5 dark:border-white/5">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[var(--color-primary)]">
                <ArrowUpCircle size={22} />
                {t('update_available')}
              </h3>
              <button 
                onClick={() => setShowUpdateModal(false)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <span className="text-xs text-gray-400 block mb-1">{t('release_details')}</span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold font-mono text-[var(--color-primary)]">{updateInfo.version}</span>
                  <span className="text-xs text-gray-500 font-mono">({updateInfo.release_date})</span>
                </div>
              </div>

              <div className="border-t border-black/5 dark:border-white/5 pt-3">
                <h4 className="font-semibold text-sm mb-2">{i18n.language === 'ar' ? 'ما الجديد في هذا التحديث:' : 'What\'s new in this release:'}</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-600 dark:text-gray-300" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                  {(i18n.language === 'ar' ? updateInfo.changelog_ar : updateInfo.changelog_en).map((line, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-black/5 dark:border-white/5">
              <button 
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="px-5 py-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer text-sm"
              >
                {t('update_later')}
              </button>
              <button 
                type="button"
                onClick={async () => {
                  setShowUpdateModal(false);
                  setCheckingUpdates(true);
                  try {
                    await updateServiceWorker(true);
                    setTimeout(() => {
                      window.location.reload();
                    }, 1500);
                  } catch (e) {
                    console.error(e);
                    window.location.reload();
                  }
                }}
                className="px-5 py-2 rounded-lg bg-[var(--color-primary)] text-white hover:brightness-110 active:scale-95 transition-all font-semibold cursor-pointer text-sm"
              >
                {t('update_now')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
