import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/currency';
import type { ProductDocType, UnitDocType } from '../database/schema';

interface CartItem {
  product: ProductDocType;
  selectedUnit: UnitDocType | null;
  quantity: number;
}

interface ReceiptProps {
  invoice: {
    invoice_id: string;
    timestamp: string;
    total_amount: number;
    currency: string;
    payment_type: string;
    clientName?: string | null;
    discount_amount?: number;
  };
  cart: CartItem[];
  settings: {
    shopName: string;
    shopPhone: string;
    shopAddress: string;
    footerMsg: string;
  };
}

export const Receipt = ({ invoice, cart, settings }: ReceiptProps) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const dateStr = new Date(invoice.timestamp).toLocaleString(
    isAr ? 'ar-EG' : 'en-US',
    {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }
  );

  return (
    <div 
      className="w-[80mm] max-w-[80mm] p-4 bg-white text-black font-mono text-xs leading-normal select-none mx-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-base font-bold uppercase tracking-wide">{settings.shopName || t('app_name')}</h2>
        {settings.shopAddress && <p className="mt-0.5">{settings.shopAddress}</p>}
        {settings.shopPhone && <p className="mt-0.5">{t('shop_phone')}: {settings.shopPhone}</p>}
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-2"></div>

      {/* Invoice Info */}
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between">
          <span>{t('invoice_id') || 'Invoice ID'}:</span>
          <span className="font-bold">{invoice.invoice_id}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('due_date') || 'Date'}:</span>
          <span>{dateStr}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('debt_type') || 'Payment'}:</span>
          <span className="font-bold">
            {invoice.payment_type === 'cash' ? t('cash') : t('debt')}
          </span>
        </div>
        {invoice.clientName && (
          <div className="flex justify-between">
            <span>{t('client_name')}:</span>
            <span className="font-bold">{invoice.clientName}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-2"></div>

      {/* Items List */}
      <div className="space-y-2">
        <div className="flex justify-between font-bold text-[10px]">
          <span className="w-1/2">{t('product_name')}</span>
          <span className="w-1/4 text-center">{t('stock') || 'Qty'}</span>
          <span className="w-1/4 text-right">{t('total') || 'Total'}</span>
        </div>
        <div className="border-t border-dashed border-black my-1"></div>
        {cart.map((item, idx) => {
          const displayName = isAr ? item.product.name_ar : item.product.name_en;
          const unitName = item.selectedUnit 
            ? item.selectedUnit.unit_name 
            : t(`unit_${item.product.unit || 'piece'}`, { defaultValue: item.product.unit || 'piece' });
          const price = item.selectedUnit ? item.selectedUnit.price_per_unit : item.product.sale_price;
          
          return (
            <div key={idx} className="text-[11px] space-y-0.5">
              <div className="font-medium line-clamp-2">{displayName}</div>
              <div className="flex justify-between text-gray-700 text-[10px]">
                <span className="w-1/2 text-gray-500">
                  ({unitName})
                </span>
                <span className="w-1/4 text-center">
                  {item.quantity} x {formatCurrency(price)}
                </span>
                <span className="w-1/4 text-right font-bold text-black" dir="ltr">
                  {formatCurrency(price * item.quantity)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-2"></div>

      {/* Total Area */}
      <div className="space-y-1.5 text-xs">
        {invoice.discount_amount && invoice.discount_amount > 0 ? (
          <>
            <div className="flex justify-between text-gray-700">
              <span>{t('subtotal')}:</span>
              <span dir="ltr">{formatCurrency(invoice.total_amount + invoice.discount_amount)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>{t('discount_amount')}:</span>
              <span dir="ltr">- {formatCurrency(invoice.discount_amount)}</span>
            </div>
          </>
        ) : null}
        <div className="flex justify-between font-bold text-sm">
          <span>{t('grand_total') || 'Grand Total'}:</span>
          <span dir="ltr">{formatCurrency(invoice.total_amount)}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-4"></div>

      {/* Footer Message */}
      {settings.footerMsg && (
        <div className="text-center text-[10px] italic whitespace-pre-line">
          {settings.footerMsg}
        </div>
      )}
    </div>
  );
};

