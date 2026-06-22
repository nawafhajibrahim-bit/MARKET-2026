import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Search, DollarSign, HandCoins, Trash2, Plus, Minus, Calculator, Printer, AlertTriangle } from 'lucide-react';
import { useDb } from '../database/Provider';
import type { ProductDocType, UnitDocType } from '../database/schema';
import { formatCurrency, getOfficialCurrency, getPOSExchangeRate, getCurrenciesList } from '../utils/currency';
import { Receipt } from '../components/Receipt';
import { useCart } from '../hooks/useCart';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

interface CartItem {
  product: ProductDocType;
  selectedUnit: UnitDocType | null; // null represents base unit (piece)
  quantity: number;
}

interface CompletedInvoice {
  invoice_id: string;
  timestamp: string;
  total_amount: number;
  currency: string;
  payment_type: string;
  clientName: string | null;
  discount_amount?: number;
}

export const POS = () => {
  const { t, i18n } = useTranslation();
  const db = useDb();

  const [products, setProducts] = useState<ProductDocType[]>([]);
  const [unitsMap, setUnitsMap] = useState<Record<string, UnitDocType[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);
  
  // Cart & Checkout State
  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('cash');
  const [clientName, setClientName] = useState('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const triggerNotification = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 4000);
  };

  const {
    cart,
    handleAddToCart,
    handleRemoveFromCart,
    handleQuantityChange,
    handleUnitChangeInCart,
    calculateCartTotal,
    clearCart
  } = useCart(unitsMap, triggerNotification, t);

  const [completedInvoice, setCompletedInvoice] = useState<CompletedInvoice | null>(null);
  const [completedCart, setCompletedCart] = useState<CartItem[]>([]);

  // Selected cart item for keyboard navigation
  const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-select last cart item when cart changes
  useEffect(() => {
    if (cart.length > 0) {
      setSelectedCartIndex(cart.length - 1);
    } else {
      setSelectedCartIndex(null);
    }
  }, [cart.length]);

  // Barcode scanner support (rapid keystrokes ending in Enter)
  useBarcodeScanner({
    enabled: !showCheckoutModal && !completedInvoice,
    onBarcode: (barcode) => {
      const raw = barcode.trim().toLowerCase();
      const match = products.find(p => p.barcode?.toLowerCase() === raw);
      if (match) {
        if (match.stock_quantity > 0) {
          handleAddToCart(match);
          triggerNotification(`${t('barcode')}: ${barcode}`, 'success');
        } else {
          triggerNotification(`${t('out_of_stock')}: ${match.name_ar || match.name_en || barcode}`, 'error');
        }
      } else {
        triggerNotification(`${t('barcode')} ${barcode}: ${t('no_products_found')}`, 'error');
      }
    }
  });

  // Keyboard shortcuts (refs avoid stale closures and dependency issues)
  const cartRef = useRef(cart);
  const selectedCartIndexRef = useRef(selectedCartIndex);
  const showModalRef = useRef(showCheckoutModal);
  const completedRef = useRef(completedInvoice);
  const tRef = useRef(t);
  const handlersRef = useRef({
    handleQuantityChange,
    handleRemoveFromCart,
    triggerNotification,
    setPaymentType,
    setShowCheckoutModal,
    setSelectedCartIndex,
    setSearchTerm,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    cartRef.current = cart;
    selectedCartIndexRef.current = selectedCartIndex;
    showModalRef.current = showCheckoutModal;
    completedRef.current = completedInvoice;
    tRef.current = t;
    handlersRef.current = {
      handleQuantityChange,
      handleRemoveFromCart,
      triggerNotification,
      setPaymentType,
      setShowCheckoutModal,
      setSelectedCartIndex,
      setSearchTerm,
    };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // F1: Focus search (works everywhere)
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Block other shortcuts when typing in inputs
      if (isInInput) return;

      // Block when modal is open or print preview is showing
      if (showModalRef.current || completedRef.current) return;

      const h = handlersRef.current;
      const c = cartRef.current;
      const selIdx = selectedCartIndexRef.current;
      const tr = tRef.current;

      if (e.key === 'F2') {
        e.preventDefault();
        if (c.length > 0) {
          h.setPaymentType('cash');
          h.setShowCheckoutModal(true);
        } else {
          h.triggerNotification(tr('cart_empty'), 'error');
        }
        return;
      }

      if (e.key === 'F3') {
        e.preventDefault();
        if (c.length > 0) {
          h.setPaymentType('debt');
          h.setShowCheckoutModal(true);
        } else {
          h.triggerNotification(tr('cart_empty'), 'error');
        }
        return;
      }

      if (e.key === '+' || e.key === 'NumpadAdd') {
        e.preventDefault();
        const idx = selIdx ?? (c.length > 0 ? c.length - 1 : null);
        if (idx !== null) h.handleQuantityChange(idx, 1);
        return;
      }

      if (e.key === '-' || e.key === 'NumpadSubtract') {
        e.preventDefault();
        const idx = selIdx ?? (c.length > 0 ? c.length - 1 : null);
        if (idx !== null) h.handleQuantityChange(idx, -1);
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        const idx = selIdx ?? (c.length > 0 ? c.length - 1 : null);
        if (idx !== null) {
          h.handleRemoveFromCart(idx);
          h.setSelectedCartIndex(prev => {
            if (prev === null) return null;
            if (prev >= c.length - 1) return Math.max(0, c.length - 2);
            return prev;
          });
        }
        return;
      }

      // Esc: clear search
      if (e.key === 'Escape') {
        h.setSearchTerm('');
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Discount State
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  
  const [printSettings, setPrintSettings] = useState({
    shopName: '',
    shopPhone: '',
    shopAddress: '',
    footerMsg: '',
  });

  const loadPrintSettings = () => {
    setPrintSettings({
      shopName: localStorage.getItem('receipt_shop_name') || '',
      shopPhone: localStorage.getItem('receipt_shop_phone') || '',
      shopAddress: localStorage.getItem('receipt_shop_address') || '',
      footerMsg: localStorage.getItem('receipt_footer') || '',
    });
  };

  // Auto-close completed invoice preview modal after 30 seconds
  useEffect(() => {
    if (completedInvoice) {
      const timer = setTimeout(() => {
        setCompletedInvoice(null);
        setCompletedCart([]);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [completedInvoice]);

  const officialCurrency = getOfficialCurrency();
  const defaultRate = getPOSExchangeRate();
  const currenciesList = getCurrenciesList();

  // Helper Calculator State
  const [showConverter, setShowConverter] = useState(false);
  const [helperCurrencyCode, setHelperCurrencyCode] = useState(() => {
    return officialCurrency.code === 'USD' ? 'IQD' : 'USD';
  });
  const [customRate, setCustomRate] = useState(defaultRate);

  // Load products reactively
  useEffect(() => {
    const productsSub = db.products.find().$.subscribe((docs) => {
      setProducts(docs.map(d => d.toJSON()));
    });

    const unitsSub = db.units.find().$.subscribe((docs) => {
      const mapping: Record<string, UnitDocType[]> = {};
      docs.forEach(doc => {
        const u = doc.toJSON();
        if (!mapping[u.product_id]) {
          mapping[u.product_id] = [];
        }
        mapping[u.product_id].push(u);
      });
      setUnitsMap(mapping);
    });

    return () => {
      productsSub.unsubscribe();
      unitsSub.unsubscribe();
    };
  }, [db]);



  const calculateDiscountAmount = () => {
    if (!discountEnabled || discountValue <= 0) return 0;
    const subtotal = calculateCartTotal();
    if (discountType === 'percentage') {
      return Math.min(subtotal, subtotal * (discountValue / 100));
    }
    return Math.min(subtotal, discountValue);
  };

  const calculateFinalTotal = () => {
    return calculateCartTotal() - calculateDiscountAmount();
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      triggerNotification(t('cart_empty'), 'error');
      return;
    }

    if (paymentType === 'debt' && !clientName) {
      triggerNotification(t('client_name') + ' ' + t('license_required'), 'error');
      return;
    }

    try {
      const discountAmount = calculateDiscountAmount();
      const totalAmount = calculateFinalTotal();
      let totalCostAmount = 0;
      const invoiceItems: Array<{
        product_id: string;
        unit_used: string;
        quantity: number;
        price: number;
      }> = [];

      // 1. Group and check stock requirements
      const stockRequirements: Record<string, { doc: import('rxdb').RxDocument<ProductDocType>; totalDeduct: number; nameAr: string; nameEn: string; costPrice: number }> = {};
      
      for (const item of cart) {
        const factor = item.selectedUnit ? item.selectedUnit.conversion_factor : 1;
        const baseQtyToDeduct = item.quantity * factor;
        const prodId = item.product.id;

        if (!stockRequirements[prodId]) {
          const pDoc = await db.products.findOne(prodId).exec();
          if (!pDoc) {
            triggerNotification(`Product not found: ${item.product.name_ar}`, 'error');
            return;
          }
          const pData = pDoc.toJSON();
          stockRequirements[prodId] = {
            doc: pDoc,
            totalDeduct: 0,
            nameAr: pData.name_ar,
            nameEn: pData.name_en,
            costPrice: pData.cost_price
          };
        }
        stockRequirements[prodId].totalDeduct += baseQtyToDeduct;
      }

      // Verify all stock demands before writing
      for (const prodId in stockRequirements) {
        const req = stockRequirements[prodId];
        const currentStock = req.doc.toJSON().stock_quantity;
        if (currentStock < req.totalDeduct) {
          triggerNotification(`${t('low_stock')}: ${i18n.language === 'ar' ? req.nameAr : req.nameEn}`, 'error');
          return;
        }
      }

      // Track running stock to avoid stale reads from the doc object during sequential updates of the same product
      const runningStock: Record<string, number> = {};
      for (const prodId in stockRequirements) {
        runningStock[prodId] = stockRequirements[prodId].doc.toJSON().stock_quantity;
      }

      // 2. Perform updates and build invoice items
      for (const item of cart) {
        const factor = item.selectedUnit ? item.selectedUnit.conversion_factor : 1;
        const baseQtyToDeduct = item.quantity * factor;
        const prodId = item.product.id;
        const req = stockRequirements[prodId];
        
        // Deduct from running stock
        const currentStock = runningStock[prodId];
        const newStock = Math.max(0, currentStock - baseQtyToDeduct);
        await req.doc.incrementalPatch({ stock_quantity: newStock });
        runningStock[prodId] = newStock;

        totalCostAmount += req.costPrice * baseQtyToDeduct;

        invoiceItems.push({
          product_id: prodId,
          unit_used: item.selectedUnit ? item.selectedUnit.unit_name : 'piece',
          quantity: item.quantity,
          price: item.selectedUnit ? item.selectedUnit.price_per_unit : req.doc.toJSON().sale_price
        });
      }

      const actualProfit = totalAmount - totalCostAmount;
      const invoiceId = 'inv-' + crypto.randomUUID();

      // Save Invoice to DB
      await db.invoices.insert({
        invoice_id: invoiceId,
        timestamp: new Date().toISOString(),
        items: invoiceItems,
        total_amount: totalAmount,
        currency: officialCurrency.code,
        exchange_rate_applied: customRate,
        payment_type: paymentType,
        actual_profit: actualProfit,
        discount_amount: discountAmount
      });

      // Save Debt to DB if needed
      if (paymentType === 'debt') {
        const debtId = 'debt-' + crypto.randomUUID();
        await db.debts.insert({
          debt_id: debtId,
          client_supplier_name: clientName,
          phone: '',
          type: 'Customer Debt',
          amount: totalAmount,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days due
          status: 'Pending'
        });
      }

      triggerNotification(t('sale_success'), 'success');
      
      // Save for Printing Preview
      setCompletedInvoice({
        invoice_id: invoiceId,
        timestamp: new Date().toISOString(),
        total_amount: totalAmount,
        currency: officialCurrency.code,
        payment_type: paymentType,
        clientName: paymentType === 'debt' ? clientName : null,
        discount_amount: discountAmount,
      });
      setCompletedCart([...cart]);
      loadPrintSettings();

      clearCart();
      setClientName('');
      setDiscountEnabled(false);
      setDiscountValue(0);
      setShowCheckoutModal(false);
    } catch (err) {
      console.error('Checkout error:', err);
      triggerNotification(t('sale_failed'), 'error');
    }
  };

  const filteredProducts = useMemo(() => {
    const query = debouncedSearchTerm.toLowerCase();
    return products.filter(p => {
      return (
        p.barcode?.toLowerCase().includes(query) ||
        p.name_ar?.toLowerCase().includes(query) ||
        p.name_en?.toLowerCase().includes(query)
      );
    });
  }, [products, debouncedSearchTerm]);

  const cartTotal = calculateCartTotal();
  const isAr = i18n.language === 'ar';

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] select-none">
      {/* Toast Notification */}
      {message && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-xl font-semibold text-white transition-all flex items-center gap-2 ${
          messageType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          <span>{messageType === 'success' ? '✅' : '⚠️'}</span>
          <span>{message}</span>
        </div>
      )}

      {/* Products Selection Area */}
      <div className="flex-1 flex flex-col gap-4 bg-white/50 dark:bg-[#16171d]/50 rounded-xl p-4 border border-black/5 dark:border-white/5 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder={t('search_barcode')}
            className="w-full pl-12 pr-4 py-4 rounded-xl text-lg bg-white dark:bg-[#1f2028] shadow-sm border-2 border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const rawQuery = searchTerm.trim().toLowerCase();
                // Try exact barcode match first
                const exactMatch = products.find(p => p.barcode?.toLowerCase() === rawQuery);
                if (exactMatch) {
                  if (exactMatch.stock_quantity > 0) {
                    handleAddToCart(exactMatch);
                    setSearchTerm('');
                  } else {
                    triggerNotification(t('out_of_stock'), 'error');
                  }
                  return;
                }
                // If only one filtered result, add it immediately
                if (filteredProducts.length === 1) {
                  const p = filteredProducts[0];
                  if (p.stock_quantity > 0) {
                    handleAddToCart(p);
                    setSearchTerm('');
                  } else {
                    triggerNotification(t('out_of_stock'), 'error');
                  }
                }
              }
            }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-2 mt-2">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full p-8 text-center text-gray-500">
              {t('no_products_found')}
            </div>
          ) : (
            filteredProducts.map((p) => {
              const displayName = isAr ? p.name_ar : p.name_en;
              return (
                <div 
                  key={p.id} 
                  onClick={() => p.stock_quantity > 0 ? handleAddToCart(p) : undefined}
                  className={`bg-white dark:bg-[#1f2028] p-4 rounded-xl shadow-sm border border-black/5 dark:border-white/5 transition-all flex flex-col justify-between aspect-square relative ${
                    p.stock_quantity > 0
                      ? 'hover:border-[var(--color-primary)] cursor-pointer active:scale-95'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  {/* Stock badges */}
                  {p.stock_quantity <= 0 && (
                    <div className="absolute top-2 end-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm">
                      {t('out_of_stock')}
                    </div>
                  )}
                  {p.stock_quantity > 0 && p.stock_quantity <= (p.min_safety_stock ?? 0) && (
                    <div className="absolute top-2 end-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm flex items-center gap-1">
                      <AlertTriangle size={10} />
                      {t('low_stock')}
                    </div>
                  )}
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto bg-purple-500/10 text-[var(--color-primary)] rounded-full mb-3 flex items-center justify-center">
                      <ShoppingCart size={22} />
                    </div>
                    <h4 className="font-semibold text-sm line-clamp-2">{displayName}</h4>
                  </div>
                  <div>
                    <div className="text-center text-[var(--color-primary)] font-bold text-sm" dir="ltr">
                      {formatCurrency(p.sale_price)}
                    </div>
                    <div className="text-center text-xs text-gray-400 mt-1">
                      {t('stock')}: {p.stock_quantity}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Cart Area */}
      <div className="w-full lg:w-[400px] flex flex-col bg-white dark:bg-[#1f2028] rounded-xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
        <div className="p-4 bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <ShoppingCart size={18} /> {t('current_sale')}
          </h3>
          <span className="px-2.5 py-1 text-xs rounded-lg font-bold bg-[var(--color-primary)]/10 text-[var(--color-primary)] uppercase">
             {officialCurrency.code}
          </span>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
              <ShoppingCart size={36} className="opacity-40 animate-bounce" />
              <span>{t('cart_empty')}</span>
            </div>
          ) : (
            cart.map((item, index) => {
              const displayName = isAr ? item.product.name_ar : item.product.name_en;
              const prodUnits = unitsMap[item.product.id] || [];
              const price = item.selectedUnit ? item.selectedUnit.price_per_unit : item.product.sale_price;

              return (
                <div 
                  key={index} 
                  onClick={() => setSelectedCartIndex(index)}
                  className={`flex flex-col gap-2 pb-3 border-b border-black/5 dark:border-white/5 rounded-lg p-2 transition-all cursor-pointer ${
                    selectedCartIndex === index 
                      ? 'bg-purple-500/10 border-l-4 border-l-[var(--color-primary)] shadow-sm' 
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm line-clamp-1">{displayName}</h4>
                      {prodUnits.length > 0 ? (
                        <select
                          value={item.selectedUnit ? item.selectedUnit.unit_id : 'base'}
                          onChange={(e) => handleUnitChangeInCart(index, e.target.value)}
                          className="mt-1 p-1 pr-4 rounded bg-black/5 dark:bg-white/5 text-xs outline-none cursor-pointer border border-transparent focus:border-[var(--color-primary)]"
                        >
                          <option value="base">{t('unit_piece')} ({formatCurrency(item.product.sale_price)})</option>
                          {prodUnits.map((u, i) => (
                            <option key={i} value={u.unit_id}>
                              {u.unit_name} (x{u.conversion_factor}) - {formatCurrency(u.price_per_unit)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">{t('unit_piece')}</span>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => handleRemoveFromCart(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-lg p-0.5">
                      <button 
                        onClick={() => handleQuantityChange(index, -1)}
                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-mono px-3 text-sm font-semibold">{item.quantity}</span>
                      <button 
                        onClick={() => handleQuantityChange(index, 1)}
                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="font-bold text-sm" dir="ltr">
                      {formatCurrency(price * item.quantity)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-black/5 dark:bg-white/5 border-t border-black/5 dark:border-white/5">
          <div className="flex justify-between items-center mb-4 text-xl">
            <span className="font-bold">{t('total')}</span>
             <span className="font-bold text-[var(--color-primary)]" dir="ltr">
                {formatCurrency(cartTotal)}
             </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <button 
               onClick={() => {
                 setPaymentType('cash');
                 setShowCheckoutModal(true);
               }}
               disabled={cart.length === 0}
               className="flex flex-col items-center justify-center gap-2 py-3 bg-green-500 hover:brightness-110 active:scale-95 text-white rounded-xl transition-all font-semibold cursor-pointer disabled:opacity-50"
             >
               <DollarSign size={18} />
               {t('cash')}
             </button>
             <button 
               onClick={() => {
                 setPaymentType('debt');
                 setShowCheckoutModal(true);
               }}
               disabled={cart.length === 0}
               className="flex flex-col items-center justify-center gap-2 py-3 bg-blue-500 hover:brightness-110 active:scale-95 text-white rounded-xl transition-all font-semibold cursor-pointer disabled:opacity-50"
             >
               <HandCoins size={18} />
               {t('debt')}
             </button>
          </div>
          <div className="text-[10px] text-gray-400 text-center mt-2 select-none">
            F1: {t('search_barcode')} | F2: {t('cash')} | F3: {t('debt')} | +/- : {i18n.language === 'ar' ? 'الكمية' : 'Qty'} | Del: {t('delete_confirm_btn')}
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-md shadow-2xl p-6 border border-black/10 dark:border-white/10">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              {paymentType === 'cash' ? <DollarSign className="text-green-500" /> : <HandCoins className="text-blue-500" />}
              {paymentType === 'cash' ? t('cash') : t('debt')}
            </h3>

            <div className="space-y-4">
              {paymentType === 'debt' && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('client_name')}</label>
                  <input 
                    type="text" 
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    placeholder="e.g. Nawaf"
                  />
                </div>
              )}

              {/* Discount Section */}
              <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discountEnabled}
                    onChange={(e) => {
                      setDiscountEnabled(e.target.checked);
                      if (!e.target.checked) setDiscountValue(0);
                    }}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                  />
                  <span className="text-sm font-medium">{t('enable_discount')}</span>
                </label>

                {discountEnabled && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDiscountType('percentage')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          discountType === 'percentage'
                            ? 'bg-[var(--color-primary)] text-white shadow-sm'
                            : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                        }`}
                      >
                        {t('discount_percentage')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          discountType === 'fixed'
                            ? 'bg-[var(--color-primary)] text-white shadow-sm'
                            : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                        }`}
                      >
                        {t('discount_fixed')}
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percentage' ? 100 : cartTotal}
                      step="0.01"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      placeholder={discountType === 'percentage' ? '0 %' : '0.00'}
                      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 focus:border-[var(--color-primary)] outline-none font-mono text-sm"
                      dir="ltr"
                    />
                  </div>
                )}
              </div>

              <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl">
                {discountEnabled && discountValue > 0 ? (
                  <>
                    <div className="flex justify-between items-center mb-2 text-sm text-gray-500">
                      <span>{t('subtotal')}</span>
                      <span className="font-bold font-mono" dir="ltr">
                        {formatCurrency(cartTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2 text-sm text-red-500">
                      <span>{t('discount_amount')}</span>
                      <span className="font-bold font-mono" dir="ltr">
                        - {formatCurrency(calculateDiscountAmount())}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2 text-sm text-gray-500 border-t border-black/5 dark:border-white/5 pt-2">
                      <span>{t('total')}</span>
                      <span className="font-bold font-mono text-[var(--color-primary)]" dir="ltr">
                        {formatCurrency(calculateFinalTotal())}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center mb-2 text-sm text-gray-500">
                    <span>{t('total')}</span>
                    <span className="font-bold font-mono" dir="ltr">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                )}
                
                {/* Dynamic Currency Converter Helper */}
                <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowConverter(!showConverter)}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] font-semibold hover:underline cursor-pointer"
                  >
                    <Calculator size={14} />
                    {showConverter ? t('hide_converter') : t('show_converter')}
                  </button>

                  {showConverter && (() => {
                    const finalTotal = calculateFinalTotal();
                    const isHelperStronger = helperCurrencyCode === 'USD' || helperCurrencyCode === 'EUR';
                    const convertedAmount = isHelperStronger 
                      ? (finalTotal / (customRate || 1)) 
                      : (finalTotal * customRate);
                    return (
                      <div className="space-y-3 bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-black/5 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{t('pay_currency')}</label>
                            <select
                              value={helperCurrencyCode}
                              onChange={(e) => setHelperCurrencyCode(e.target.value)}
                              className="w-full p-1.5 text-xs rounded bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 outline-none"
                            >
                              {currenciesList
                                .filter(c => c.code !== officialCurrency.code)
                                .map(c => (
                                  <option key={c.code} value={c.code}>
                                    {c.code} ({c.symbol})
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-400 mb-0.5">
                              {helperCurrencyCode === 'USD' || helperCurrencyCode === 'EUR'
                                ? `1 ${helperCurrencyCode} =`
                                : `1 ${officialCurrency.code} =`
                              }
                            </label>
                            <input
                              type="number"
                              value={customRate || ''}
                              onChange={(e) => setCustomRate(Number(e.target.value))}
                              className="w-full p-1.5 text-xs rounded bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 font-mono outline-none"
                            />
                          </div>
                        </div>
                        <div className="text-center pt-2 border-t border-black/5 dark:border-white/5">
                          <span className="text-xs text-gray-500">{t('amount_to_collect')}:</span>
                          <p className="text-lg font-bold text-green-500 font-mono mt-0.5" dir="ltr">
                            {convertedAmount.toLocaleString(undefined, {
                              minimumFractionDigits: helperCurrencyCode === 'USD' || helperCurrencyCode === 'EUR' ? 2 : 0,
                              maximumFractionDigits: helperCurrencyCode === 'USD' || helperCurrencyCode === 'EUR' ? 2 : 0,
                            })} {currenciesList.find(c => c.code === helperCurrencyCode)?.symbol || helperCurrencyCode}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-black/5 dark:border-white/5">
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="px-5 py-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCheckout}
                className="px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                {t('confirm_sale')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {completedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-4xl shadow-2xl p-6 border border-black/10 dark:border-white/10 flex flex-col md:flex-row gap-6 max-h-[90vh]">
            
            {/* Left: Options & Info */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-green-500">
                  <span>✅</span>
                  {t('sale_success_title')}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {t('invoice_id')}: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{completedInvoice.invoice_id}</span>
                </p>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('total')}</span>
                      <span className="font-bold font-mono" dir="ltr">{formatCurrency(completedInvoice.total_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('debt_type') || 'Payment'}</span>
                      <span className="font-bold">{completedInvoice.payment_type === 'cash' ? t('cash') : t('debt')}</span>
                    </div>
                    {completedInvoice.clientName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('client_name')}</span>
                        <span className="font-bold">{completedInvoice.clientName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-black/5 dark:border-white/5">
                <button
                  onClick={() => {
                    setCompletedInvoice(null);
                    setCompletedCart([]);
                  }}
                  className="flex-1 py-3 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-semibold text-center cursor-pointer animate-all"
                >
                  {t('done_new_sale')}
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20"
                >
                  <Printer size={18} />
                  {t('print')}
                </button>
              </div>
            </div>

            {/* Right: Live Interactive Mockup */}
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
                    invoice={completedInvoice}
                    cart={completedCart}
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
        {completedInvoice && (
          <Receipt
            invoice={completedInvoice}
            cart={completedCart}
            settings={printSettings}
          />
        )}
      </div>
    </div>
  );
};
