import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, RefreshCcw, CheckCircle, AlertCircle, Coins, Printer } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { useDb } from '../database/Provider';
import { getCurrenciesList, addCustomCurrency, getOfficialCurrency, setOfficialCurrency } from '../utils/currency';

interface GoogleTokenResponse {
  access_token: string;
}

export const Settings = () => {
  const { t } = useTranslation();
  const db = useDb();
  
  const [isAutoBackup, setIsAutoBackup] = useState(() => localStorage.getItem('auto_backup_enabled') === 'true');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
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

      <div className="bg-white dark:bg-[#1f2028] p-6 rounded-xl shadow-sm border border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
            <CloudUpload className="text-[var(--color-primary)]" size={28} />
            <h3 className="text-xl font-semibold">{t('google_drive_backup')}</h3>
        </div>

        <div className="space-y-6">
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

            <div className="pt-4 flex items-center justify-between border-t border-black/5 dark:border-white/5">
                <div>
                    <h4 className="font-medium">{t('manual_backup')}</h4>
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
                <div className="flex items-center gap-2 text-green-600 bg-green-500/10 p-3 rounded-lg font-medium">
                    <CheckCircle size={18} /> {t('backup_success')}
                </div>
            )}
            {backupStatus === 'error' && (
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
