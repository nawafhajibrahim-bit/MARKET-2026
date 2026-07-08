import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { X, Camera } from 'lucide-react';

interface CameraScannerModalProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({ onScan, onClose }) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let isScanning = true;

    try {
      // Initialize the scanner
      scanner = new Html5QrcodeScanner(
        'qr-reader',
        { 
          fps: 10, 
          qrbox: { width: 250, height: 150 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true
        },
        false
      );

      scanner.render(
        (decodedText) => {
          if (isScanning) {
            isScanning = false;
            onScan(decodedText);
            onClose();
          }
        },
        (errorMessage) => {
          // Ignore frequent "not found" errors, only log actual failures if needed
        }
      );
    } catch (err) {
      console.error("Camera error: ", err);
      setError(isAr ? 'لم نتمكن من الوصول للكاميرا، يرجى التأكد من الصلاحيات.' : 'Could not access the camera, please check permissions.');
    }

    return () => {
      isScanning = false;
      if (scanner) {
        scanner.clear().catch(e => console.error("Failed to clear scanner", e));
      }
    };
  }, [onScan, onClose, isAr]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1f2028] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Camera className="text-[var(--color-primary)]" size={20} />
            {isAr ? 'مسح الباركود بالكاميرا' : 'Scan Barcode via Camera'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center">
          {error ? (
            <div className="text-red-500 text-center font-bold p-4 bg-red-500/10 rounded-xl">
              {error}
            </div>
          ) : (
            <div className="w-full">
              <div id="qr-reader" className="w-full rounded-xl overflow-hidden [&_video]:w-full [&_video]:rounded-xl [&>div]:!border-none" />
              <p className="text-center text-sm text-gray-500 mt-4">
                {isAr ? 'وجه الكاميرا نحو باركود المنتج...' : 'Point the camera at the product barcode...'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
