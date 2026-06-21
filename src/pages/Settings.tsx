import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, RefreshCcw, CheckCircle, AlertCircle, Coins, Printer, Download, Upload, Trash2, Play } from 'lucide-react';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { useDb } from '../database/Provider';
import { getCurrenciesList, addCustomCurrency, getOfficialCurrency, setOfficialCurrency } from '../utils/currency';
import { getLocalBackups, deleteLocalBackup, type LocalBackup } from '../services/backupStorageService';
import { runAutoBackup } from '../components/AutoBackupRunner';

interface GoogleTokenResponse {
  access_token: string;
}

export const Settings = () => {
  const { t } = useTranslation();
  const db = useDb();
  
  const [isAutoBackup, setIsAutoBackup] = useState(() => localStorage.getItem('auto_backup_enabled') === 'true');
  const [autoBackupLocal, setAutoBackupLocal] = useState(() => localStorage.getItem('auto_backup_local') !== 'false');
  const [autoBackupCloud, setAutoBackupCloud] = useState(() => localStorage.getItem('auto_backup_cloud') === 'true');
  const [autoBackupDownloadFile, setAutoBackupDownloadFile] = useState(() => localStorage.getItem('auto_backup_download_file') === 'true');
  const [autoBackupInterval, setAutoBackupInterval] = useState(() => localStorage.getItem('auto_backup_interval') || '60');
  const [autoBackupOnExit, setAutoBackupOnExit] = useState(() => localStorage.getItem('auto_backup_on_exit') !== 'false');
  const [localBackups, setLocalBackups] = useState<LocalBackup[]>([]);

  const loadLocalBackupsList = async () => {
    const list = await getLocalBackups();
    setLocalBackups(list);
  };

  useEffect(() => {
    loadLocalBackupsList();
    
    // Listen for automatic backup completion events to refresh list
    const handleBackupCompleted = () => {
      loadLocalBackupsList();
    };
    window.addEventListener('auto_backup_completed', handleBackupCompleted);
    return () => {
      window.removeEventListener('auto_backup_completed', handleBackupCompleted);
    };
  }, []);

  const handleToggleAutoBackupLocal = (val: boolean) => {
    setAutoBackupLocal(val);
    localStorage.setItem('auto_backup_local', val.toString());
  };

  const handleToggleAutoBackupCloud = (val: boolean) => {
    setAutoBackupCloud(val);
    localStorage.setItem('auto_backup_cloud', val.toString());
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

      const collections = ['products', 'units', 'invoices', 'debts', 'system_config'];
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
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [customClientId, setCustomClientId] = useState(() => localStorage.getItem('custom_google_client_id') || '');
  const [localBackupStatus, setLocalBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [customGroqKey, setCustomGroqKey] = useState(() => localStorage.getItem('custom_groq_key') || '');
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
  const [aiEnabled, setAiEnabled] = useState(() => localStorage.getItem('ai_enabled') === 'true');

  const [currencies, setCurrencies] = useState(getCurrenciesList);
  const [officialCurrency, setOfficialCurrencyState] = useState(getOfficialCurrency().code);
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

  const handleSavePrintSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('receipt_shop_name', shopName);
    localStorage.setItem('receipt_shop_phone', shopPhone);
    localStorage.setItem('receipt_shop_address', shopAddress);
    localStorage.setItem('receipt_footer', receiptFooter);
    setPrintSuccess(t('print_settings_saved') || 'Print settings saved successfully');
    setTimeout(() => setPrintSuccess(null), 3000);
  };

  const handleOfficialCurrencyChange = (code: string) => {
    setOfficialCurrency(code);
    setOfficialCurrencyState(code);
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

  const handleCustomClientIdChange = (val: string) => {
    setCustomClientId(val);
    if (val.trim()) {
      localStorage.setItem('custom_google_client_id', val.trim());
    } else {
      localStorage.removeItem('custom_google_client_id');
    }
    window.dispatchEvent(new Event('google_client_id_changed'));
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

        const collections = ['products', 'units', 'invoices', 'debts', 'system_config'];
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

  const executeBackup = async (tokenResponse: GoogleTokenResponse) => {
    setBackupStatus('loading');
    try {
        const driveService = new GoogleDriveService(tokenResponse.access_token);
        const success = await driveService.backupDatabase(db);
        
        if (success) {
            setBackupStatus('success');
            setLastBackup(new Date().toLocaleString());
            setTimeout(() => setBackupStatus('idle'), 3000);
        } else {
            setBackupStatus('error');
        }
    } catch (err) {
        console.error(err);
        setBackupStatus('error');
    }
  };

  const loginForBackup = useGoogleLogin({
    onSuccess: executeBackup,
    onError: () => setBackupStatus('error'),
    scope: 'https://www.googleapis.com/auth/drive.file'
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold">{t('settings')}</h2>

      {/* Auto-Backup & Cloud Settings Card */}
      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
            <CloudUpload className="text-[var(--color-primary)]" size={28} />
            <h3 className="text-xl font-semibold">{t('google_drive_backup')}</h3>
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
                                    checked={autoBackupCloud}
                                    onChange={(e) => handleToggleAutoBackupCloud(e.target.checked)}
                                    className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4"
                                />
                                <span>{t('backup_target_cloud')}</span>
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
                            <option value="15">{t('interval_15m')}</option>
                            <option value="30">{t('interval_30m')}</option>
                            <option value="60">{t('interval_1h')}</option>
                            <option value="180">{t('interval_3h')}</option>
                            <option value="360">{t('interval_6h')}</option>
                            <option value="720">{t('interval_12h')}</option>
                            <option value="1440">{t('interval_24h')}</option>
                        </select>
                    </div>

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

            {/* Google Drive Account Link (Manual Backup button) */}
            <div className="pt-4 flex items-center justify-between border-t border-black/5 dark:border-white/5">
                <div>
                    <h4 className="font-medium">{t('manual_backup')} (Google Drive)</h4>
                    <p className="text-sm text-gray-500">
                        {lastBackup ? t('last_backup', { time: lastBackup }) : t('never_backed_up')}
                    </p>
                </div>
                <button 
                    onClick={() => loginForBackup()}
                    disabled={backupStatus === 'loading'}
                    className="flex items-center gap-2 px-6 py-2 bg-[var(--color-primary)] text-white font-medium rounded-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                    {backupStatus === 'loading' ? (
                        <><RefreshCcw size={18} className="animate-spin" /> {t('backing_up')}</>
                    ) : (
                        <><CloudUpload size={18} /> {t('backup_now')}</>
                    )}
                </button>
            </div>

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

            {/* Custom Google Client ID Input */}
            <div className="pt-6 border-t border-black/5 dark:border-white/5 space-y-2">
                <label className="block text-sm font-medium">{t('google_client_id_label')}</label>
                <p className="text-xs text-gray-500 mb-1">{t('google_client_id_desc')}</p>
                <input 
                    type="text"
                    value={customClientId}
                    onChange={(e) => handleCustomClientIdChange(e.target.value)}
                    placeholder={t('google_client_id_placeholder') || 'Enter Google Client ID...'}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all font-mono text-xs"
                />
            </div>

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
          <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">{t('custom_groq_key')}</label>
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-primary)] hover:underline">
                  {t('get_groq_key') || 'Get API Key'}
                </a>
              </div>
              <input 
                type="password"
                value={customGroqKey}
                onChange={(e) => handleCustomKeyChange(e.target.value)}
                placeholder={t('custom_groq_key_placeholder')}
                className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
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
    </div>
  );
};
