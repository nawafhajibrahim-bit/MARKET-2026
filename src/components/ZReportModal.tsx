import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer, FileText, TrendingUp, DollarSign, HandCoins, ShoppingCart, Package } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import type { InvoiceDocType, ProductDocType } from '../database/schema';

interface ZReportModalProps {
  invoices: InvoiceDocType[];
  products: ProductDocType[];
  onClose: () => void;
}

export const ZReportModal: React.FC<ZReportModalProps> = ({ invoices, products, onClose }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const todayInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invDate = new Date(inv.timestamp);
      return invDate >= today;
    });
  }, [invoices, today]);

  const stats = useMemo(() => {
    const totalRevenue = todayInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalProfit = todayInvoices.reduce((sum, inv) => sum + (inv.actual_profit || 0), 0);
    const cashSales = todayInvoices.filter(inv => inv.payment_type === 'cash').reduce((sum, inv) => sum + inv.total_amount, 0);
    const debtSales = todayInvoices.filter(inv => inv.payment_type === 'debt').reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalItems = todayInvoices.reduce((sum, inv) => sum + (inv.items || []).reduce((s, item) => s + (item.quantity || 0), 0), 0);

    // Top products today
    const productSaleCount: Record<string, number> = {};
    todayInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        if (item.product_id) {
          productSaleCount[item.product_id] = (productSaleCount[item.product_id] || 0) + (item.quantity || 0);
        }
      });
    });

    const topProducts = Object.entries(productSaleCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const prod = products.find(p => p.id === id);
        const name = prod ? (isAr ? prod.name_ar : (prod.name_en || prod.name_ar)) : id;
        return { name, count };
      });

    return {
      invoiceCount: todayInvoices.length,
      totalRevenue,
      totalProfit,
      cashSales,
      debtSales,
      totalItems,
      topProducts,
    };
  }, [todayInvoices, products, isAr]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-lg shadow-2xl p-6 border border-black/10 dark:border-white/10 max-h-[90vh] overflow-y-auto print:shadow-none print:border-none print:max-h-none print:overflow-visible">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/10 dark:border-white/10">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FileText className="text-[var(--color-primary)]" size={22} />
            {t('z_report')}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title={t('print_z_report')}
            >
              <Printer size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Date */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500">
            {today.toLocaleDateString(isAr ? 'ar-IQ' : 'en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-green-500" />
              <span className="text-xs text-green-600 font-medium">{t('cash')}</span>
            </div>
            <p className="text-lg font-bold text-green-600" dir="ltr">{formatCurrency(stats.cashSales)}</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <HandCoins size={16} className="text-blue-500" />
              <span className="text-xs text-blue-600 font-medium">{t('debt')}</span>
            </div>
            <p className="text-lg font-bold text-blue-600" dir="ltr">{formatCurrency(stats.debtSales)}</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-purple-500" />
              <span className="text-xs text-purple-600 font-medium">{t('real_profit')}</span>
            </div>
            <p className="text-lg font-bold text-purple-600" dir="ltr">{formatCurrency(stats.totalProfit)}</p>
          </div>
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart size={16} className="text-orange-500" />
              <span className="text-xs text-orange-600 font-medium">{t('items_count')}</span>
            </div>
            <p className="text-lg font-bold text-orange-600">{stats.totalItems}</p>
          </div>
        </div>

        {/* Summary Row */}
        <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500">{t('total_revenue')}</span>
            <span className="text-xl font-bold text-[var(--color-primary)]" dir="ltr">{formatCurrency(stats.totalRevenue)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>{t('invoice_id')}: {stats.invoiceCount} {t('items_count')}</span>
          </div>
        </div>

        {/* Top Products */}
        {stats.topProducts.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Package size={16} className="text-[var(--color-primary)]" />
              {t('top_selling_products')}
            </h4>
            <div className="space-y-2">
              {stats.topProducts.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                  <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}</span>
                  <span className="text-sm flex-1 truncate">{item.name}</span>
                  <span className="text-xs font-bold text-[var(--color-primary)]">{item.count} {t('units_sold')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-6 pt-4 border-t border-black/10 dark:border-white/10">
          <p>Smart Market POS — {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};
