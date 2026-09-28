import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Copy, Check, Download, ExternalLink, Share2 } from 'lucide-react';

interface StoreQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoreQRCodeModal: React.FC<StoreQRCodeModalProps> = ({ isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [customOrigin, setCustomOrigin] = useState(() => localStorage.getItem('store_qr_origin') || (typeof window !== 'undefined' ? window.location.origin : ''));
  const [showAdvanced, setShowAdvanced] = useState(false);

  const storeUrl = `${customOrigin}/store`;
  
  const shopName = localStorage.getItem('receipt_shop_name') || 'متجر ماركت 2026';

  const handleSaveOrigin = (val: string) => {
    setCustomOrigin(val);
    localStorage.setItem('store_qr_origin', val);
  };

  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(storeUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#4c1d95',
        light: '#ffffff',
      },
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Failed to generate QR code:', err));
  }, [isOpen, storeUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('فشل نسخ الرابط، يمكنك نسخه يدوياً');
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `market-store-qr-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareWhatsApp = () => {
    const msg = `تفضل بزيارة متجرنا والطلب مباشرة عبر الرابط التالي:\n${storeUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <QrCode className="text-purple-600" size={20} />
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              رمز QR لمتجر الزبائن
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Store Title */}
        <div className="mb-4">
          <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 rounded-full">
            {shopName}
          </span>
          <p className="text-xs text-slate-500 mt-1.5">
            امسح الرمز بكاميرا الجوال للدخول المباشر إلى المتجر والطلب
          </p>
        </div>

        {/* QR Display */}
        <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-100 mx-auto inline-block mb-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Store QR Code"
              className="w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-xl"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
              جاري إنشاء الرمز...
            </div>
          )}
        </div>

        {/* Store URL Box */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 mb-4 text-xs font-mono">
          <span className="truncate text-slate-600 dark:text-slate-300 direction-ltr text-left">
            {storeUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-purple-600 border border-slate-200 dark:border-slate-600 transition shrink-0 cursor-pointer"
            title="نسخ الرابط"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Custom Origin Settings */}
        <div className="mb-4 text-right">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[10px] text-purple-600 hover:underline font-bold"
          >
            {showAdvanced ? 'إخفاء الإعدادات المتقدمة' : 'الإعدادات المتقدمة (للشبكة المحلية)'}
          </button>
          
          {showAdvanced && (
            <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <label className="block text-slate-500 mb-1">نطاق الشبكة (IP) أو الرابط الأساسي:</label>
              <input 
                type="text" 
                value={customOrigin}
                onChange={(e) => handleSaveOrigin(e.target.value)}
                placeholder="مثال: http://192.168.1.5:5173"
                dir="ltr"
                className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-purple-500 font-mono text-[10px]"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <button
            onClick={handleDownloadQR}
            className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 transition cursor-pointer"
          >
            <Download size={14} />
            <span>تحميل الصورة</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
          >
            <Share2 size={14} />
            <span>مشاركة عبر واتساب</span>
          </button>
        </div>

        <div className="mt-3">
          <a
            href="/store"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-purple-600 font-bold hover:underline"
          >
            <ExternalLink size={12} />
            <span>معاينة صفحة المتجر الآن</span>
          </a>
        </div>
      </div>
    </div>
  );
};
