import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '../database/Provider';
import type { ProductDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';
import { 
  ShoppingCart, Search, Plus, Minus, Trash2, CheckCircle2, 
  Send, MessageCircle, ArrowRight, Store as StoreIcon, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CartItem {
  product: ProductDocType;
  quantity: number;
}

export const Store = () => {
  const db = useDb();
  const [products, setProducts] = useState<ProductDocType[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('market_customer_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Customer form inputs
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('market_cust_name') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('market_cust_phone') || '');
  const [customerAddress, setCustomerAddress] = useState(() => localStorage.getItem('market_cust_address') || '');
  const [customerNotes, setCustomerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Store metadata
  const storeName = localStorage.getItem('receipt_shop_name') || 'ماركت 2026';
  const whatsappNumber = localStorage.getItem('market_whatsapp_number') || '9647510171376';

  // Save cart to local storage
  useEffect(() => {
    localStorage.setItem('market_customer_cart', JSON.stringify(cart));
  }, [cart]);

  // Load products
  useEffect(() => {
    if (!db) return;
    const sub = db.products.find().$.subscribe(docs => {
      // Only show available products to customers
      const allProds = docs.map(d => d.toJSON());
      setProducts(allProds.filter(p => p.is_available !== false));
    });
    return () => sub.unsubscribe();
  }, [db]);

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !search.trim() || 
        (p.name_ar && p.name_ar.toLowerCase().includes(search.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  // Cart operations
  const addToCart = (product: ProductDocType) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, quantity: qty } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('market_customer_cart');
  };

  // Calculations (Customer price only!)
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = (item.product.discount_price && item.product.discount_price > 0)
        ? item.product.discount_price
        : item.product.sale_price;
      return sum + (price * item.quantity);
    }, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Send Order within App (Method 1)
  const handleAppOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('يرجى كتابة الاسم ورقم الهاتف لإتمام الطلب');
      return;
    }

    setSubmitting(true);
    try {
      // Save customer info for future visits
      localStorage.setItem('market_cust_name', customerName.trim());
      localStorage.setItem('market_cust_phone', customerPhone.trim());
      if (customerAddress) localStorage.setItem('market_cust_address', customerAddress.trim());

      const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
      const orderId = 'ord:' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

      // Prepare items for DB (Includes internal cost_price silently calculated by server/local db for the admin)
      let estimatedCost = 0;
      const orderItems = cart.map(item => {
        const salePrice = (item.product.discount_price && item.product.discount_price > 0)
          ? item.product.discount_price
          : item.product.sale_price;
        const costPrice = Number(item.product.cost_price) || 0;
        const subtotal = salePrice * item.quantity;
        estimatedCost += (costPrice * item.quantity);

        return {
          product_id: item.product.id,
          name: item.product.name_ar,
          unit: item.product.unit || 'كرتونة',
          quantity: item.quantity,
          sale_price: salePrice,
          cost_price: costPrice, // Internal only
          actual_cost_price: costPrice,
          subtotal
        };
      });

      const profit = totalAmount - estimatedCost;

      await db.orders.insert({
        order_id: orderId,
        order_number: orderNumber,
        created_at: new Date().toISOString(),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim() || 'لم يحدد العنوان',
        notes: customerNotes.trim(),
        items: orderItems,
        total_amount: totalAmount,
        estimated_cost: estimatedCost,
        actual_cost: estimatedCost,
        profit: profit,
        status: 'new', // جديد
        order_source: 'web',
        supplier_notes: ''
      });

      setOrderSuccess(orderNumber);
      clearCart();
      setIsCartOpen(false);
    } catch (err) {
      console.error('Failed to submit order:', err);
      alert('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى أو الطلب عبر واتساب');
    } finally {
      setSubmitting(false);
    }
  };

  // Send Order via WhatsApp (Method 2)
  const handleWhatsAppOrder = () => {
    if (cart.length === 0) {
      alert('السلة فارغة، يرجى اختيار المنتجات أولاً');
      return;
    }

    let message = `*طلب جديد من متجر ${storeName}*\n\n`;
    if (customerName.trim()) message += `👤 *الاسم:* ${customerName.trim()}\n`;
    if (customerPhone.trim()) message += `📱 *الهاتف:* ${customerPhone.trim()}\n`;
    if (customerAddress.trim()) message += `📍 *العنوان:* ${customerAddress.trim()}\n`;
    if (customerNotes.trim()) message += `📝 *ملاحظات:* ${customerNotes.trim()}\n`;
    message += `----------------------------\n*تفاصيل الطلب:*\n`;

    cart.forEach((item, index) => {
      const price = (item.product.discount_price && item.product.discount_price > 0)
        ? item.product.discount_price
        : item.product.sale_price;
      const unit = item.product.unit || 'كرتونة';
      message += `${index + 1}. ${item.product.name_ar} × ${item.quantity} ${unit} = ${formatCurrency(price * item.quantity)}\n`;
    });

    message += `----------------------------\n`;
    message += `💰 *الإجمالي المطلوب:* ${formatCurrency(totalAmount)}\n`;
    message += `شكراً لكم!`;

    const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Quick WhatsApp inquiry for a single product
  const handleSingleProductWhatsApp = (product: ProductDocType) => {
    const price = (product.discount_price && product.discount_price > 0)
      ? product.discount_price
      : product.sale_price;
    const unit = product.unit || 'كرتونة';
    const message = `مرحباً، أريد الاستفسار عن طلب:\n*${product.name_ar}*\nالوحدة: ${unit}\nالسعر: ${formatCurrency(price)}`;
    const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/20">
              <StoreIcon size={22} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-tight">
                {storeName}
              </h1>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                بيع وطلب حسب الحاجة • بأسعار مناسبة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* WhatsApp Direct Header Link */}
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-xs"
            >
              <MessageCircle size={16} />
              <span>تواصل واتساب</span>
            </a>

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-600/20 transition active:scale-95 cursor-pointer"
            >
              <ShoppingCart size={18} />
              <span className="hidden sm:inline">السلة</span>
              {totalItemsCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-purple-700 text-xs font-black">
                  {totalItemsCount}
                </span>
              )}
            </button>

            {/* Link to Admin Dashboard */}
            <Link
              to="/"
              className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="لوحة الإدارة"
            >
              <ArrowRight size={20} className="rotate-180" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white py-8 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-right space-y-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs">
              <Sparkles size={14} className="text-yellow-300" />
              طلب مباشر حسب احتياجك
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              أفضل المنتجات بالكرتونة والكميات بأسهل طريقة
            </h2>
            <p className="text-purple-100 text-sm max-w-xl">
              تصفح المنتجات واطلب مباشرة من الموقع أو أرسل طلبيتك فوراً عبر واتساب لنجهزها ونوصلها لك.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                const el = document.getElementById('products-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-2.5 rounded-xl bg-white text-purple-700 hover:bg-purple-50 font-bold text-sm shadow-md transition cursor-pointer"
            >
              تصفح المنتجات
            </button>
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md flex items-center gap-2 transition"
            >
              <MessageCircle size={18} />
              طلب سريع عبر واتساب
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main id="products-section" className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Categories Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن منتج، كرتونة، زيت، أرز..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm shadow-xs transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                مسح
              </button>
            )}
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-300'
              }`}
            >
              جميع المنتجات ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Order Success Alert */}
        {orderSuccess && (
          <div className="mb-8 p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black">تم إرسال طلبك بنجاح!</h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  رقم طلبك هو: <strong className="font-mono text-base">{orderSuccess}</strong>. سنقوم بمراجعة الطلب وتجهيزه والتواصل معك سريعاً.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOrderSuccess(null)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً، أرسلت طلباً برقم ${orderSuccess} وأود تأكيده ومتابعته معكم.`)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 text-xs font-bold border border-emerald-300 flex items-center gap-1.5 transition"
              >
                <MessageCircle size={14} />
                تأكيد عبر واتساب
              </a>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <StoreIcon className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={48} />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">لا توجد منتجات مطابقة للبحث</h3>
            <p className="text-xs text-slate-400 mt-1">جرب البحث بكلمة أخرى أو اختر تصنيفاً آخر</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => {
              const hasDiscount = !!(product.discount_price && product.discount_price > 0 && product.discount_price < product.sale_price);
              const activePrice = hasDiscount ? product.discount_price! : product.sale_price;
              const cartItem = cart.find(c => c.product.id === product.id);
              const unitLabel = product.unit || 'كرتونة';

              return (
                <div
                  key={product.id}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden"
                >
                  {/* Product Image / Placeholder */}
                  <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name_ar}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <StoreIcon size={48} className="text-slate-300 dark:text-slate-600" />
                    )}

                    {/* Badge / Discount Tag */}
                    {(product.badge || hasDiscount) && (
                      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                        {product.badge && (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-black shadow-xs">
                            {product.badge}
                          </span>
                        )}
                        {hasDiscount && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black shadow-xs">
                            خصم
                          </span>
                        )}
                      </div>
                    )}

                    {/* Unit Pill */}
                    <div className="absolute bottom-2 left-2">
                      <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold">
                        {unitLabel}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Category */}
                      <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                        {product.category || 'عام'}
                      </span>

                      {/* Product Name */}
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                        {product.name_ar}
                      </h3>

                      {/* Description */}
                      {product.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Price and Cart Controls */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-baseline justify-between mb-3">
                        <div>
                          <span className="text-xs text-slate-400">السعر: </span>
                          <span className="text-lg font-black text-slate-900 dark:text-white">
                            {formatCurrency(activePrice)}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs text-slate-400 line-through mr-2">
                              {formatCurrency(product.sale_price)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          لكل {unitLabel}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {cartItem ? (
                          <div className="flex-1 flex items-center justify-between bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-1">
                            <button
                              onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 flex items-center justify-center hover:bg-purple-100 shadow-xs transition cursor-pointer"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-sm font-black text-purple-900 dark:text-purple-100">
                              {cartItem.quantity} {unitLabel}
                            </span>
                            <button
                              onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                              className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 shadow-xs transition cursor-pointer"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-98 transition cursor-pointer"
                          >
                            <ShoppingCart size={15} />
                            <span>أضف للسلة</span>
                          </button>
                        )}

                        {/* Quick WhatsApp Inquiry for this product */}
                        <button
                          onClick={() => handleSingleProductWhatsApp(product)}
                          className="p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100 transition cursor-pointer"
                          title="استفسار سريع عبر واتساب"
                        >
                          <MessageCircle size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Drawer / Slide-Over Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-purple-600" size={20} />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  سلة الطلبات ({totalItemsCount})
                </h2>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="mx-auto text-slate-300 mb-2" size={40} />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">السلة فارغة حالياً</p>
                  <p className="text-xs text-slate-400 mt-1">اختر المنتجات والكميات المطلوبة للمتابعة</p>
                </div>
              ) : (
                cart.map(item => {
                  const price = (item.product.discount_price && item.product.discount_price > 0)
                    ? item.product.discount_price
                    : item.product.sale_price;
                  const unitLabel = item.product.unit || 'كرتونة';

                  return (
                    <div
                      key={item.product.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.product.name_ar}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span>{formatCurrency(price)} / {unitLabel}</span>
                          <span>•</span>
                          <span className="font-bold text-purple-600">
                            الإجمالي: {formatCurrency(price * item.quantity)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-black w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Checkout Form & Actions */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                {/* Total */}
                <div className="flex items-center justify-between text-base font-black border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span>إجمالي الطلب:</span>
                  <span className="text-purple-600 text-xl font-black">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>

                {/* Customer Information Inputs */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    بيانات المستلم والتوصيل:
                  </p>
                  <div>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="الاسم الكامل *"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="رقم الهاتف للتواصل والتأكيد *"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="عنوان التوصيل (المدينة / الحي / المعلم)"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="ملاحظات إضافية على الطلب (اختياري)"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Submit Buttons: Method 1 and Method 2 */}
                <div className="space-y-2 pt-1">
                  {/* Method 1: App Order */}
                  <button
                    onClick={handleAppOrder}
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={16} />
                    <span>{submitting ? 'جاري إرسال الطلب...' : 'إرسال وتأكيد الطلب الآن'}</span>
                  </button>

                  {/* Method 2: WhatsApp Direct Order */}
                  <button
                    onClick={handleWhatsAppOrder}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-bold text-sm shadow-md shadow-emerald-500/30 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <MessageCircle size={18} />
                    <span>إرسال الطلب عبر واتساب</span>
                  </button>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={clearCart}
                      className="text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      إفراغ السلة
                    </button>
                    <span className="text-[11px] text-slate-400">
                      التوصيل حسب الاتفاق
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Bottom Bar on Mobile if Cart has items */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden z-30">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full p-4 rounded-2xl bg-purple-600 text-white font-black text-sm shadow-xl flex items-center justify-between active:scale-98 transition"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span>مراجعة السلة ({totalItemsCount})</span>
            </div>
            <span>{formatCurrency(totalAmount)}</span>
          </button>
        </div>
      )}
    </div>
  );
};
