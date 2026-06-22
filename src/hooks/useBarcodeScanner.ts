import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onBarcode: (barcode: string) => void;
  enabled?: boolean;
}

/**
 * Detects barcode scanner input (rapid keystrokes ending in Enter).
 * Barcode scanners act like keyboards: they type the barcode very fast
 * (<50ms between characters) and send an Enter key at the end.
 * 
 * This hook ignores typing in normal input fields.
 */
export function useBarcodeScanner({ onBarcode, enabled = true }: UseBarcodeScannerOptions) {
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTimeRef = useRef(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if user is actively typing in an input, textarea, or select
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // If it's a barcode scanner in an input field, we might still want to catch it
      // but only if the typing is extremely rapid. For now, we let the input handle it.
      return;
    }

    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;

    const isEnter = e.key === 'Enter';
    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

    if (isEnter && bufferRef.current.length >= 3) {
      // Barcode complete — fire callback
      const barcode = bufferRef.current.trim();
      bufferRef.current = '';
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      onBarcode(barcode);
      e.preventDefault();
      return;
    }

    if (isEnter && bufferRef.current.length > 0 && bufferRef.current.length < 3) {
      // Short buffer — probably not a barcode, reset
      bufferRef.current = '';
      return;
    }

    if (isPrintable) {
      // If typing was slow (>120ms since last char), reset buffer
      if (timeSinceLastKey > 120 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }
      bufferRef.current += e.key;

      // Reset buffer after idle time if no Enter comes
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, 150);
    }
  }, [enabled, onBarcode]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleKeyDown]);
}
