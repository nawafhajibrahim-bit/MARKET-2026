import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Bot, Smartphone, CheckCircle, X } from 'lucide-react';

export const WelcomeModal = () => {
  const { t, i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const isAr = i18n.language.startsWith('ar');

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('has_seen_welcome_v1');
    if (!hasSeenWelcome) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('has_seen_welcome_v1', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div 
        className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="bg-[var(--color-primary)] text-white p-6 relative">
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          <h2 className="text-2xl font-bold mb-2">{t('welcome_modal_title')}</h2>
          <p className="text-white/90 text-sm">{t('welcome_modal_desc')}</p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Step 1: Backup */}
          <div className="flex gap-4 items-start p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <HardDrive size={24} />
            </div>
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-300 text-lg mb-1">{t('welcome_step1_title')}</h3>
              <p className="text-amber-700 dark:text-amber-200/80 text-sm leading-relaxed">
                {t('welcome_step1_desc')}
              </p>
            </div>
          </div>

          {/* Step 2: AI */}
          <div className="flex gap-4 items-start p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30 rounded-xl">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-bold text-purple-800 dark:text-purple-300 text-lg mb-1">{t('welcome_step2_title')}</h3>
              <p className="text-purple-700 dark:text-purple-200/80 text-sm leading-relaxed">
                {t('welcome_step2_desc')}
              </p>
            </div>
          </div>

          {/* Step 3: PWA */}
          <div className="flex gap-4 items-start p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="font-bold text-blue-800 dark:text-blue-300 text-lg mb-1">{t('welcome_step3_title')}</h3>
              <p className="text-blue-700 dark:text-blue-200/80 text-sm leading-relaxed">
                {t('welcome_step3_desc')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-black/5 dark:border-white/5 bg-gray-50 dark:bg-black/20 flex justify-end">
          <button
            onClick={handleClose}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <CheckCircle size={20} />
            <span>{t('welcome_close_btn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
