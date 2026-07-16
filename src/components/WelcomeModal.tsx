import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Send, AlertTriangle, HelpCircle, Star, ExternalLink, PlayCircle, CheckCircle } from 'lucide-react';
// I'll import Telegram differently since Send is already imported
import { Send as Telegram } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ isOpen, onClose }: WelcomeModalProps) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const [activeTab, setActiveTab] = useState<'updates' | 'feedback'>('updates');
  const [loading, setLoading] = useState(true);
  
  const [config, setConfig] = useState({
    show_beta_warning: true,
    ads_title: isAr ? 'التحديثات الأخيرة' : 'Latest Updates',
    ads_text: '',
    youtube_link: '',
    telegram_link: '',
    other_apps_link: ''
  });

  // Feedback form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackPhone, setFeedbackPhone] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    // Check if auto-opened
    const hasSeenWelcome = localStorage.getItem('has_seen_welcome_v2');
    if (!hasSeenWelcome) {
      localStorage.setItem('has_seen_welcome_v2', 'true');
    }

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/developer-portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-config' })
        });
        const data = await res.json();
        if (res.ok && data.success && data.config) {
          setConfig(data.config);
        }
      } catch (err) {
        console.error('Failed to fetch developer config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [isOpen]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMsg.trim()) return;
    
    setFeedbackLoading(true);
    try {
      const res = await fetch('/api/developer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-feedback',
          feedback: {
            rating,
            message: feedbackMsg,
            name: feedbackName,
            phone: feedbackPhone
          }
        })
      });
      
      if (res.ok) {
        setFeedbackSuccess(true);
        setFeedbackMsg('');
      } else {
        alert(isAr ? 'حدث خطأ أثناء الإرسال' : 'Failed to send feedback');
      }
    } catch (err) {
      alert(isAr ? 'خطأ في الاتصال' : 'Network error');
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div 
        className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="bg-[var(--color-primary)] text-white p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <HelpCircle size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{isAr ? 'التحديثات والمقترحات' : 'Updates & Feedback'}</h2>
              <p className="text-white/80 text-sm">{isAr ? 'تعرف على الجديد أو أرسل مقترحاتك للمطور.' : "See what's new or send feedback to the developer."}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5">
          <button
            onClick={() => setActiveTab('updates')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'updates' ? 'bg-white dark:bg-[#1f2028] text-[var(--color-primary)] border-t-2 border-[var(--color-primary)]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {isAr ? '🚀 التحديثات' : '🚀 Updates'}
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'feedback' ? 'bg-white dark:bg-[#1f2028] text-[var(--color-primary)] border-t-2 border-[var(--color-primary)]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {isAr ? '💡 اقترح ميزة' : '💡 Suggestion / Feedback'}
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent"></div>
            </div>
          ) : (
            <>
              {activeTab === 'updates' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  {config.show_beta_warning && (
                    <div className="flex gap-3 items-start p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl text-orange-800 dark:text-orange-300">
                      <AlertTriangle size={24} className="shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold mb-1">{isAr ? 'نسخة تجريبية (Beta)' : 'Beta Version'}</h4>
                        <p className="text-sm opacity-90 leading-relaxed">
                          {isAr 
                            ? 'هذا النظام ما زال قيد التطوير والاختبار. قد تواجه بعض الأخطاء أو التغييرات المستمرة. لا يتحمل المطور أي مسؤولية عن فقدان البيانات. شكراً لتفهمكم ودعمكم في تحسين النظام.'
                            : 'This system is in active development (Beta). You may encounter bugs. The developer is not responsible for data loss. Thanks for your support!'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-5">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <Star className="text-yellow-500" size={20} />
                      {config.ads_title || (isAr ? 'التحديثات الأخيرة' : 'Latest Updates')}
                    </h3>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {config.ads_text || (isAr ? 'لا توجد تحديثات جديدة حالياً.' : 'No new updates right now.')}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {config.youtube_link && (
                      <a href={config.youtube_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-xl transition-colors font-bold text-sm">
                        <PlayCircle size={20} />
                        {isAr ? 'شرح فيديو للميزات' : 'Video Tutorial'}
                      </a>
                    )}
                    {config.telegram_link && (
                      <a href={config.telegram_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-xl transition-colors font-bold text-sm">
                        <Telegram size={20} />
                        {isAr ? 'قناة التليجرام' : 'Telegram Channel'}
                      </a>
                    )}
                    {config.other_apps_link && (
                      <a href={config.other_apps_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded-xl transition-colors font-bold text-sm sm:col-span-2">
                        <ExternalLink size={20} />
                        {isAr ? 'تصفح برامجنا وتطبيقاتنا الأخرى' : 'Explore our other apps'}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'feedback' && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                  {feedbackSuccess ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle size={32} />
                      </div>
                      <h3 className="text-xl font-bold">{isAr ? 'شكراً لك!' : 'Thank you!'}</h3>
                      <p className="text-gray-500">{isAr ? 'تم إرسال تقييمك ومقترحك للمطور بنجاح.' : 'Your feedback was sent successfully.'}</p>
                      <button onClick={() => setFeedbackSuccess(false)} className="mt-4 px-6 py-2 text-sm font-bold bg-black/5 dark:bg-white/5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                        {isAr ? 'إرسال المزيد' : 'Send more'}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitFeedback} className="space-y-5">
                      <div>
                        <label className="block text-sm font-bold mb-2 text-center">{isAr ? 'ما هو تقييمك للبرنامج؟' : 'How do you rate the app?'}</label>
                        <div className="flex justify-center gap-2 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              className="p-1 cursor-pointer transition-transform hover:scale-110"
                            >
                              <Star 
                                size={36} 
                                className={`${(hoverRating || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} 
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">{isAr ? 'رسالتك أو مقترحك (مطلوب)' : 'Your message (Required)'}</label>
                        <textarea
                          required
                          value={feedbackMsg}
                          onChange={(e) => setFeedbackMsg(e.target.value)}
                          className="w-full p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none min-h-[120px] resize-y"
                          placeholder={isAr ? 'اكتب اقتراحك، مشكلتك، أو رأيك هنا...' : 'Write your suggestion or issue...'}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">{isAr ? 'الاسم (اختياري)' : 'Name (Optional)'}</label>
                          <input
                            type="text"
                            value={feedbackName}
                            onChange={(e) => setFeedbackName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                            placeholder={isAr ? 'اسمك' : 'Your name'}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">{isAr ? 'رقم الهاتف (اختياري)' : 'Phone (Optional)'}</label>
                          <input
                            type="tel"
                            value={feedbackPhone}
                            onChange={(e) => setFeedbackPhone(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                            placeholder={isAr ? 'للتواصل معك' : 'For contact'}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={feedbackLoading || !feedbackMsg.trim()}
                        className="w-full py-3.5 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[var(--color-primary)]/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {feedbackLoading ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <Send size={18} />
                            {isAr ? 'إرسال للمطور' : 'Send to Developer'}
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
