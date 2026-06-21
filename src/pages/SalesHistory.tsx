import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Search, Printer, RotateCcw, X, Calendar, Download } from 'lucide-react';
import { useDb } from '../database/Provider';
import type { ProductDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';
import { Receipt } from '../components/Receipt';

interface InvoiceItem {
  product_id: string;
  unit_used: string;
  quantity: number;
  price: number;
}

interface InvoiceDoc {
  invoice_id: string;
  timestamp: string;
  items: InvoiceItem[];
  total_amount: number;
  currency: string;
  exchange_rate_applied?: number;
  payment_type: string;
  actual_profit?: number;
  discount_amount?: number;
}

export const SalesHistory = () => {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const isAr = i18n.language === 'ar';

  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [products, setProducts] = useState<ProductDocType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDoc | null>(null);

  // Print preview
  const [printInvoice, setPrintInvoice] = useState<InvoiceDoc | null>(null);

  // Return modal
  const [returnInvoice, setReturnInvoice] = useState<InvoiceDoc | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnProcessing, setReturnProcessing] = useState(false);

  // Toast
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const triggerNotification = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 4000);
  };

  const [printSettings, setPrintSettings] = useState({
    shopName: '',
    shopPhone: '',
    shopAddress: '',
    footerMsg: '',
  });

  useEffect(() => {
    const invoiceSub = db.invoices.find({
      sort: [{ timestamp: 'desc' }]
    }).$.subscribe((docs: any[]) => {
      setInvoices(docs.map((d: any) => d.toJSON()));
    });

    const productsSub = db.products.find().$.subscribe((docs: any[]) => {
      setProducts(docs.map((d: any) => d.toJSON()));
    });

    return () => {
      invoiceSub.unsubscribe();
      productsSub.unsubscribe();
    };
  }, [db]);

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return productId;
    return isAr ? product.name_ar : product.name_en;
  };

  const filteredInvoices = invoices.filter(inv => {
    // Search filter
    if (searchTerm && !inv.invoice_id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    // Date range filter
    if (dateFrom) {
      const invDate = new Date(inv.timestamp).toISOString().split('T')[0];
      if (invDate < dateFrom) return false;
    }
    if (dateTo) {
      const invDate = new Date(inv.timestamp).toISOString().split('T')[0];
      if (invDate > dateTo) return false;
    }
    return true;
  });

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleString(isAr ? 'ar-IQ' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleOpenReturn = (invoice: InvoiceDoc) => {
    setReturnInvoice(invoice);
    const initQty: Record<number, number> = {};
    invoice.items.forEach((_, idx) => {
      initQty[idx] = 0;
    });
    setReturnQuantities(initQty);
  };

  const handleConfirmReturn = async () => {
    if (!returnInvoice) return;
    setReturnProcessing(true);

    try {
      const returnItems: InvoiceItem[] = [];
      let refundProfit = 0;

      for (let i = 0; i < returnInvoice.items.length; i++) {
        const item = returnInvoice.items[i];
        const returnQty = returnQuantities[i] || 0;
        if (returnQty <= 0) continue;

        // Add stock back
        const pDoc = await db.products.findOne(item.product_id).exec();
        let costPrice = 0;
        if (pDoc) {
          const pData = pDoc.toJSON();
          costPrice = pData.cost_price;
          // For base unit, factor is 1. For other units, we'd need to look it up.
          let factor = 1;
          if (item.unit_used !== 'piece') {
            const unitDocs = await db.units.find({
              selector: { product_id: item.product_id }
            }).exec();
            const matchingUnit = unitDocs.find((u: any) => u.toJSON().unit_name === item.unit_used);
            if (matchingUnit) {
              factor = matchingUnit.toJSON().conversion_factor;
            }
          }
          const baseQtyToReturn = returnQty * factor;
          await pDoc.incrementalPatch({
            stock_quantity: pData.stock_quantity + baseQtyToReturn
          });

          // Calculate returned profit
          const itemCost = costPrice * factor;
          // Profit returned = (sale price per unit - cost price per unit) * return quantity
          const itemProfit = (item.price - itemCost) * returnQty;
          refundProfit += itemProfit;
        }

        returnItems.push({
          product_id: item.product_id,
          unit_used: item.unit_used,
          quantity: returnQty,
          price: item.price
        });
      }

      if (returnItems.length === 0) {
        setReturnProcessing(false);
        return;
      }

      // Calculate refund total
      const refundTotal = returnItems.reduce((sum, ri) => sum + (ri.price * ri.quantity), 0);

      // Create negative invoice record
      const returnInvoiceId = 'ret-' + crypto.randomUUID();
      await db.invoices.insert({
        invoice_id: returnInvoiceId,
        timestamp: new Date().toISOString(),
        items: returnItems,
        total_amount: -refundTotal,
        currency: returnInvoice.currency,
        exchange_rate_applied: returnInvoice.exchange_rate_applied || 1,
        payment_type: 'return',
        actual_profit: -refundProfit
      });

      triggerNotification(t('return_success'), 'success');
      setReturnInvoice(null);
    } catch (err) {
      console.error('Return error:', err);
      triggerNotification(t('sale_failed'), 'error');
    } finally {
      setReturnProcessing(false);
    }
  };

  const handlePrintInvoice = (invoice: InvoiceDoc) => {
    setPrintSettings({
      shopName: localStorage.getItem('receipt_shop_name') || '',
      shopPhone: localStorage.getItem('receipt_shop_phone') || '',
      shopAddress: localStorage.getItem('receipt_shop_address') || '',
      footerMsg: localStorage.getItem('receipt_footer') || '',
    });
    setPrintInvoice(invoice);
  };

  const triggerPrint = () => {
    window.print();
  };

  // Build cart items for receipt from invoice items
  const buildCartFromInvoice = (invoice: InvoiceDoc) => {
    return invoice.items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        product: product || {
          id: item.product_id,
          barcode: '',
          sku_serial: '',
          name_ar: item.product_id,
          name_en: item.product_id,
          category: '',
          cost_price: 0,
          sale_price: item.price,
          stock_quantity: 0,
          min_safety_stock: 0,
          expiry_date: '',
        },
        selectedUnit: item.unit_used !== 'piece' ? {
          unit_id: '',
          product_id: item.product_id,
          unit_name: item.unit_used,
          conversion_factor: 1,
          price_per_unit: item.price,
        } : null,
        quantity: item.quantity,
      };
    });
  };

  const exportInvoicesToCSV = () => {
    const headers = [
      t('invoice_id'),
      t('due_date'),
      t('total'),
      t('debt_type'),
      t('items_count')
    ];

    const rows = filteredInvoices.map(inv => [
      inv.invoice_id,
      new Date(inv.timestamp).toLocaleString(),
      inv.total_amount,
      inv.payment_type === 'cash' ? t('cash') : inv.payment_type === 'return' ? t('return_refund') : t('debt'),
      inv.items?.length || 0
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoices_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {message && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-xl font-semibold text-white transition-all flex items-center gap-2 ${
          messageType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          <span>{messageType === 'success' ? '✅' : '⚠️'}</span>
          <span>{message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-[var(--color-primary)]" size={24} />
            {t('sales_history')}
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('search_invoice')}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="pl-10 pr-3 py-3 rounded-xl bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm"
              title={t('date_from')}
              dir="ltr"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="pl-10 pr-3 py-3 rounded-xl bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm"
              title={t('date_to')}
              dir="ltr"
            />
          </div>
          <button 
            onClick={exportInvoicesToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all font-medium cursor-pointer"
            title={t('export_csv')}
          >
            <Download size={16} />
            <span className="hidden md:inline">{t('export_csv')}</span>
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-[#1f2028] rounded-xl border border-black/5 dark:border-white/5 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse" dir={isAr ? 'rtl' : 'ltr'}>
          <thead>
            <tr className="bg-black/5 dark:bg-white/5 text-sm uppercase tracking-wider text-gray-500">
              <th className="p-4 font-medium">{t('invoice_id')}</th>
              <th className="p-4 font-medium">{t('due_date')}</th>
              <th className="p-4 font-medium">{t('total')}</th>
              <th className="p-4 font-medium">{t('debt_type')}</th>
              <th className="p-4 font-medium text-center">{t('items_count')}</th>
              <th className="p-4 font-medium text-center">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <FileText size={40} className="opacity-30" />
                    <p>{t('no_invoices')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const isReturn = inv.total_amount < 0;
                return (
                  <tr
                    key={inv.invoice_id}
                    className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <td className="p-4">
                      <span className={`font-mono font-semibold text-sm ${isReturn ? 'text-red-500' : ''}`}>
                        {inv.invoice_id}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{formatDate(inv.timestamp)}</td>
                    <td className="p-4">
                      <span className={`font-bold font-mono ${isReturn ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`} dir="ltr">
                        {formatCurrency(inv.total_amount)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        inv.payment_type === 'cash'
                          ? 'bg-green-500/10 text-green-500'
                          : inv.payment_type === 'return'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {inv.payment_type === 'cash' ? t('cash') : inv.payment_type === 'return' ? t('return_refund') : t('debt')}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-medium">
                        {inv.items?.length || 0}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handlePrintInvoice(inv)}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[var(--color-primary)] hover:brightness-110 text-white rounded-lg font-medium transition-all active:scale-95 cursor-pointer"
                          title={t('reprint')}
                        >
                          <Printer size={13} />
                          {t('reprint')}
                        </button>
                        {!isReturn && inv.payment_type !== 'return' && (
                          <button
                            onClick={() => handleOpenReturn(inv)}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all active:scale-95 cursor-pointer"
                            title={t('return_refund')}
                          >
                            <RotateCcw size={13} />
                            {t('return_refund')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-lg shadow-2xl border border-black/10 dark:border-white/10 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/5 dark:border-white/5">
              <h3 className="text-xl font-bold">{t('invoice_details')}</h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Invoice Info */}
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('invoice_id')}:</span>
                <span className="font-mono font-bold">{selectedInvoice.invoice_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('due_date')}:</span>
                <span>{formatDate(selectedInvoice.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('debt_type')}:</span>
                <span className="font-bold">
                  {selectedInvoice.payment_type === 'cash' ? t('cash') : selectedInvoice.payment_type === 'return' ? t('return_refund') : t('debt')}
                </span>
              </div>
            </div>

            {/* Items List */}
            <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-sm mb-2">{t('items_count')}: {selectedInvoice.items?.length || 0}</h4>
              {selectedInvoice.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm py-2 border-b border-black/5 dark:border-white/5 last:border-0">
                  <div>
                    <p className="font-medium">{getProductName(item.product_id)}</p>
                    <p className="text-xs text-gray-400">({item.unit_used}) × {item.quantity}</p>
                  </div>
                  <span className="font-bold font-mono" dir="ltr">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
              {selectedInvoice.discount_amount && selectedInvoice.discount_amount > 0 && (
                <div className="flex justify-between items-center text-sm mb-2 text-red-500">
                  <span>{t('discount_amount')}:</span>
                  <span className="font-bold font-mono" dir="ltr">- {formatCurrency(selectedInvoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-bold">
                <span>{t('total')}</span>
                <span className={`font-mono ${selectedInvoice.total_amount < 0 ? 'text-red-500' : 'text-green-500'}`} dir="ltr">
                  {formatCurrency(selectedInvoice.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-lg shadow-2xl border border-black/10 dark:border-white/10 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/5 dark:border-white/5">
              <h3 className="text-xl font-bold">{t('return_title')}</h3>
              <button
                onClick={() => setReturnInvoice(null)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              {t('invoice_id')}: <span className="font-mono font-bold">{returnInvoice.invoice_id}</span>
            </p>

            <div className="space-y-3">
              {returnInvoice.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{getProductName(item.product_id)}</p>
                    <p className="text-xs text-gray-400">
                      ({item.unit_used}) × {item.quantity} — {formatCurrency(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">{t('return_quantity')}:</label>
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={returnQuantities[idx] || 0}
                      onChange={(e) => {
                        const val = Math.min(item.quantity, Math.max(0, Number(e.target.value)));
                        setReturnQuantities({ ...returnQuantities, [idx]: val });
                      }}
                      className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 text-center text-sm font-mono outline-none focus:border-[var(--color-primary)]"
                      dir="ltr"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Refund total preview */}
            {
              (() => {
                const refundTotal = returnInvoice.items.reduce((sum, item, idx) => {
                  return sum + ((returnQuantities[idx] || 0) * item.price);
                }, 0);
                return refundTotal > 0 ? (
                  <div className="mt-4 p-3 bg-red-500/10 rounded-xl flex justify-between items-center">
                    <span className="text-sm font-medium text-red-500">{t('total')} {t('return_refund')}:</span>
                    <span className="font-bold font-mono text-red-500" dir="ltr">- {formatCurrency(refundTotal)}</span>
                  </div>
                ) : null;
              })()
            }

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-black/5 dark:border-white/5">
              <button
                onClick={() => setReturnInvoice(null)}
                className="px-5 py-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmReturn}
                disabled={returnProcessing || Object.values(returnQuantities).every(v => v === 0)}
                className="px-6 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {returnProcessing ? t('processing') : t('return_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-4xl shadow-2xl p-6 border border-black/10 dark:border-white/10 flex flex-col md:flex-row gap-6 max-h-[90vh]">
            {/* Left: Options */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <Printer className="text-[var(--color-primary)]" size={22} />
                  {t('reprint')}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t('invoice_id')}: <span className="font-mono font-bold">{printInvoice.invoice_id}</span>
                </p>
                <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('total')}</span>
                    <span className="font-bold font-mono" dir="ltr">{formatCurrency(printInvoice.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('debt_type')}</span>
                    <span className="font-bold">
                      {printInvoice.payment_type === 'cash' ? t('cash') : printInvoice.payment_type === 'return' ? t('return_refund') : t('debt')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-black/5 dark:border-white/5">
                <button
                  onClick={() => setPrintInvoice(null)}
                  className="flex-1 py-3 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-semibold cursor-pointer text-center"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={triggerPrint}
                  className="flex-1 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20"
                >
                  <Printer size={18} />
                  {t('print')}
                </button>
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden min-h-[300px] md:min-h-0">
              <div className="p-3 bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-xs font-semibold text-gray-500 flex justify-between items-center">
                <span>{t('preview')}</span>
                <span className="uppercase text-[10px] bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded font-mono">
                  80mm
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex justify-center items-start bg-gray-500/10">
                <div className="shadow-lg rounded-lg overflow-hidden bg-white max-w-full">
                  <Receipt
                    invoice={{
                      invoice_id: printInvoice.invoice_id,
                      timestamp: printInvoice.timestamp,
                      total_amount: printInvoice.total_amount,
                      currency: printInvoice.currency,
                      payment_type: printInvoice.payment_type,
                      discount_amount: printInvoice.discount_amount,
                    }}
                    cart={buildCartFromInvoice(printInvoice)}
                    settings={printSettings}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Hidden Print Container */}
      <div id="print-area" className="hidden print:block">
        {printInvoice && (
          <Receipt
            invoice={{
              invoice_id: printInvoice.invoice_id,
              timestamp: printInvoice.timestamp,
              total_amount: printInvoice.total_amount,
              currency: printInvoice.currency,
              payment_type: printInvoice.payment_type,
              discount_amount: printInvoice.discount_amount,
            }}
            cart={buildCartFromInvoice(printInvoice)}
            settings={printSettings}
          />
        )}
      </div>

    </div>
  );
};
