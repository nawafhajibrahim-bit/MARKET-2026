import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, Package, FileText, QrCode, Store, ClipboardList, Truck, DollarSign } from 'lucide-react';
import { useDb } from '../database/Provider';
import type { InvoiceDocType, DebtDocType, ProductDocType, OrderDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';
import { ZReportModal } from '../components/ZReportModal';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { StoreQRCodeModal } from '../components/StoreQRCodeModal';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const AIEngine = React.lazy(() => import('../modules/ai/AIEngine'));

export const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const db = useDb();
  const { isAdmin } = useAuth();
  
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [showZReport, setShowZReport] = useState(false);
  const [data, setData] = useState<{
    invoices: InvoiceDocType[];
    debts: DebtDocType[];
    products: ProductDocType[];
    orders: OrderDocType[];
    sysConfig: any;
  }>({
    invoices: [],
    debts: [],
    products: [],
    orders: [],
    sysConfig: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAi = () => setAiEnabled(localStorage.getItem('ai_enabled') !== 'false');
    checkAi();
    window.addEventListener('storage', checkAi);
    window.addEventListener('currency_changed', checkAi);
    return () => {
      window.removeEventListener('storage', checkAi);
      window.removeEventListener('currency_changed', checkAi);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const [invoiceDocs, debtDocs, productDocs, orderDocs, configDoc] = await Promise.all([
          db.invoices.find().exec(),
          db.debts.find().exec(),
          db.products.find().exec(),
          db.orders.find().exec(),
          db.system_config.findOne('config').exec(),
        ]);

        if (isMounted) {
          setData({
            invoices: invoiceDocs.map(d => d.toJSON()),
            debts: debtDocs.map(d => d.toJSON()),
            products: productDocs.map(d => d.toJSON()),
            orders: orderDocs.map(d => d.toJSON()),
            sysConfig: configDoc ? configDoc.toJSON() : null,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadStats();

    // Subscribe for live updates
    const invoicesSub = db.invoices.find().$.subscribe(() => loadStats());
    const debtsSub = db.debts.find().$.subscribe(() => loadStats());
    const productsSub = db.products.find().$.subscribe(() => loadStats());
    const ordersSub = db.orders.find().$.subscribe(() => loadStats());

    return () => {
      isMounted = false;
      invoicesSub.unsubscribe();
      debtsSub.unsubscribe();
      productsSub.unsubscribe();
      ordersSub.unsubscribe();
    };
  }, [db]);

  const stats = React.useMemo(() => {
    const { invoices, debts, products } = data;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Today revenue
    const todayRevenue = invoices
      .filter(inv => new Date(inv.timestamp) >= todayStart)
      .reduce((sum, inv) => sum + inv.total_amount, 0);

    // Month revenue
    const monthRevenue = invoices
      .filter(inv => new Date(inv.timestamp) >= monthStart)
      .reduce((sum, inv) => sum + inv.total_amount, 0);

    // Total profit (all time)
    const totalProfit = invoices.reduce((sum, inv) => sum + (inv.actual_profit || 0), 0);

    // Pending debts
    const pendingDebts = debts
      .filter(d => d.status === 'Pending' && d.type === 'Customer Debt')
      .reduce((sum, d) => sum + d.amount, 0);

    // Low stock
    const lowStockCount = products.filter(p => p.stock_quantity <= (p.min_safety_stock ?? 0)).length;

    // Expiring products (within 30 days)
    const nowExp = new Date();
    const thirtyDaysFromNow = new Date(nowExp.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringProducts = products.filter(p => {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date);
      return exp <= thirtyDaysFromNow && exp >= nowExp;
    });
    const expiredProducts = products.filter(p => {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date);
      return exp < nowExp;
    });

    // Build last 6 months chart data
    const monthlyMap: Record<string, { revenue: number; profit: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyMap[key] = { revenue: 0, profit: 0 };
    }

    invoices.forEach(inv => {
      const d = new Date(inv.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthlyMap[key] !== undefined) {
        monthlyMap[key].revenue += inv.total_amount;
        monthlyMap[key].profit += inv.actual_profit || 0;
      }
    });

    const monthNames = [
      t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'),
      t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec'),
    ];

    const monthlyChart = Object.entries(monthlyMap).map(([key, val]) => {
      const [, month] = key.split('-').map(Number);
      return {
        name: monthNames[month],
        revenue: parseFloat(val.revenue.toFixed(2)),
        profit: parseFloat(val.profit.toFixed(2)),
      };
    });

    // Top selling products from invoice items
    const productSaleCount: Record<string, number> = {};
    invoices.forEach(inv => {
      (inv.items || []).forEach((item) => {
        if (item.product_id && item.quantity !== undefined) {
          const qty = (inv.total_amount || 0) >= 0 ? item.quantity : -item.quantity;
          productSaleCount[item.product_id] = (productSaleCount[item.product_id] || 0) + qty;
        }
      });
    });

    const topProducts = Object.entries(productSaleCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const prod = products.find(p => p.id === id);
        const name = prod
          ? (i18n.language === 'ar' ? prod.name_ar : (prod.name_en || prod.name_ar))
          : id;
        return { name, count };
      });

    // Orders Calculations (Customer Orders system)
    const orders = data.orders || [];
    const newOrders = orders.filter(o => o.status === 'new');
    const totalOrdersRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalOrdersCost = orders.reduce((sum, o) => sum + (o.actual_cost ?? o.estimated_cost ?? 0), 0);
    const totalOrdersProfit = totalOrdersRevenue - totalOrdersCost;

    // Combined financial metrics (Invoices + Orders)
    const combinedRevenue = (invoices.reduce((sum, inv) => sum + inv.total_amount, 0)) + totalOrdersRevenue;
    const combinedCost = totalOrdersCost;
    const combinedProfit = totalProfit + totalOrdersProfit;

    // Product frequency calculation from orders + invoices
    const productFrequency: Record<string, { count: number; name: string; unit: string; revenue: number }> = {};
    products.forEach(p => {
      productFrequency[p.id] = {
        count: 0,
        name: isAr ? p.name_ar : (p.name_en || p.name_ar),
        unit: p.unit || 'كرتونة',
        revenue: 0
      };
    });

    // Count from orders
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        if (item.product_id && productFrequency[item.product_id]) {
          productFrequency[item.product_id].count += item.quantity;
          productFrequency[item.product_id].revenue += item.subtotal;
        }
      });
    });

    // Count from invoices
    invoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        if (item.product_id && productFrequency[item.product_id]) {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          productFrequency[item.product_id].count += qty;
          productFrequency[item.product_id].revenue += (price * qty);
        }
      });
    });

    const frequencyList = Object.values(productFrequency);
    const topMovingProducts = [...frequencyList].sort((a, b) => b.count - a.count).filter(p => p.count > 0).slice(0, 5);
    const leastMovingProducts = [...frequencyList].filter(p => p.count > 0).sort((a, b) => a.count - b.count).slice(0, 5);
    const stagnantProducts = frequencyList.filter(p => p.count === 0).slice(0, 5);

    let licenseDaysRemaining = null;
    let isTrial = false;
    if (data.sysConfig && data.sysConfig.license_expiry) {
      const expDate = new Date(data.sysConfig.license_expiry);
      const diffMs = expDate.getTime() - now.getTime();
      licenseDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isTrial = !data.sysConfig.license_key || data.sysConfig.license_key.trim() === '';
    }

    return {
      todayRevenue,
      monthRevenue,
      totalProfit,
      pendingDebts,
      lowStockCount,
      totalProducts: products.length,
      monthlyChart,
      topProducts,
      expiringProducts,
      expiredProducts,
      licenseDaysRemaining,
      isTrial,
      // New On-Demand & Orders KPIs
      ordersCount: orders.length,
      newOrdersCount: newOrders.length,
      totalOrdersRevenue,
      totalOrdersCost,
      totalOrdersProfit,
      combinedRevenue,
      combinedCost,
      combinedProfit,
      topMovingProducts,
      leastMovingProducts,
      stagnantProducts
    };
  }, [data, t, i18n, isAr]);

  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="space-y-6">
      {stats.licenseDaysRemaining !== null && !stats.isTrial && stats.licenseDaysRemaining <= 7 && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border shadow-sm ${stats.licenseDaysRemaining <= 3 ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
          <AlertTriangle className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-base">
              {stats.isTrial ? (isAr ? 'تنبيه انتهاء الفترة التجريبية' : 'Trial Ending Soon') : (isAr ? 'تنبيه انتهاء الاشتراك' : 'Subscription Ending Soon')}
            </h3>
            <p className="text-sm mt-1">
              {isAr 
                ? `بقي ${stats.licenseDaysRemaining} يوم على انتهاء ${stats.isTrial ? 'الفترة التجريبية' : 'الاشتراك'}. يرجى طلب التمديد لتجنب توقف النظام.`
                : `Your ${stats.isTrial ? 'trial' : 'subscription'} will expire in ${stats.licenseDaysRemaining} days. Please request an extension to avoid interruption.`
              }
            </p>
            <div className="mt-3">
              <button 
                onClick={() => setShowSubscriptionModal(true)}
                className="px-4 py-2 bg-white/50 hover:bg-white border border-black/10 dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/40 rounded-lg text-sm font-bold transition-all cursor-pointer inline-flex"
              >
                {isAr ? 'إدارة الاشتراك والتفعيل' : 'Manage Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>لوحة التحكم والإحصائيات</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة المبيعات، الطلبات، تكلفة الشراء من الموردين، والأرباح الحقيقية
          </p>
        </div>
          
        <div className="flex flex-wrap items-center gap-2">
          {/* QR Button */}
          <button
            onClick={() => setShowQrModal(true)}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs text-xs cursor-pointer"
          >
            <QrCode size={16} />
            <span>رمز QR المتجر</span>
          </button>

          {/* Customer Store Link */}
          <a
            href="/store"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs text-xs cursor-pointer"
          >
            <Store size={16} />
            <span>متجر الزبائن ↗</span>
          </a>

          {/* Orders Page Link */}
          <Link
            to="/orders"
            className="relative px-3.5 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold rounded-xl transition-all flex items-center gap-1.5 border border-purple-500/20 text-xs"
          >
            <ClipboardList size={16} />
            <span>إدارة الطلبات</span>
            {stats.newOrdersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center">
                {stats.newOrdersCount}
              </span>
            )}
          </Link>

          {/* Suppliers Page Link */}
          <Link
            to="/suppliers"
            className="px-3.5 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all flex items-center gap-1.5 border border-black/5 dark:border-white/5 text-xs"
          >
            <Truck size={16} />
            <span>الموردين</span>
          </Link>

          {isAdmin && (
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="px-3 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-500 dark:text-slate-400 font-medium rounded-xl transition-all flex items-center gap-1 text-xs"
            >
              <FileText size={15} />
              <span>الاشتراك</span>
            </button>
          )}

          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
              <span>{t('loading')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards: Sales, Wholesale Cost, Real Profit, Orders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1f2028] shadow-xs border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي المبيعات</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white" dir="ltr">
            {fmt(stats.combinedRevenue)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            طلبات المتجر: {fmt(stats.totalOrdersRevenue)}
          </span>
        </div>

        {/* Wholesale Purchase Cost */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1f2028] shadow-xs border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
              تكلفة الشراء من المورد (سري 🔒)
            </span>
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
              <Truck size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-700 dark:text-purple-300" dir="ltr">
            {fmt(stats.combinedCost)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            ما تم دفعه لمخازن الجملة
          </span>
        </div>

        {/* Net Profit */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1f2028] shadow-xs border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              الربح الإجمالي الفعلي
            </span>
            <div className="p-2 bg-emerald-500/20 text-emerald-600 rounded-xl">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
            +{fmt(stats.combinedProfit)}
          </p>
          <span className="text-[11px] text-emerald-600/80 mt-1 block font-medium">
            (المبيعات - تكلفة الشراء)
          </span>
        </div>

        {/* Orders Count & Status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1f2028] shadow-xs border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">طلبات الزبائن</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <ClipboardList size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.ordersCount} <span className="text-xs font-normal text-slate-400">طلب</span>
          </p>
          <span className="text-[11px] text-amber-600 mt-1 font-bold block">
            {stats.newOrdersCount > 0 ? `🔥 ${stats.newOrdersCount} طلب جديد بانتظار التأكيد` : 'جميع الطلبات معالجة'}
          </span>
        </div>
      </div>

      {/* AI Smart Assistant - Moved to top for better visibility */}
      {aiEnabled && (
        <React.Suspense fallback={<div className="p-4 text-center">{t('ai_loading')}</div>}>
          <AIEngine />
        </React.Suspense>
      )}

      {/* Alerts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.lowStockCount > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <div className="p-2.5 bg-orange-500/20 rounded-xl flex-shrink-0">
              <AlertTriangle size={20} className="text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-orange-600 dark:text-orange-400">{t('low_stock_alert_title')}</p>
              <p className="text-sm text-orange-500">{t('low_stock_alert_desc', { count: stats.lowStockCount })}</p>
            </div>
          </div>
        )}
        
        {/* Expired products alert */}
        {stats.expiredProducts.length > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="p-2.5 bg-red-500/20 rounded-xl flex-shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-red-600 dark:text-red-400">{t('expired_products_alert_title') || 'منتجات منتهية الصلاحية'}</p>
              <p className="text-sm text-red-500">{t('expired_products_alert_desc', { count: stats.expiredProducts.length }) || `${stats.expiredProducts.length} منتجات تجاوزت تاريخ الانتهاء`}</p>
            </div>
          </div>
        )}
        
        {/* Expiring soon products alert */}
        {stats.expiringProducts.length > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="p-2.5 bg-yellow-500/20 rounded-xl flex-shrink-0">
              <AlertTriangle size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="font-semibold text-yellow-700 dark:text-yellow-400">{t('expiring_products_alert_title') || 'منتجات قاربت على الانتهاء'}</p>
              <p className="text-sm text-yellow-600">{t('expiring_products_alert_desc', { count: stats.expiringProducts.length }) || `${stats.expiringProducts.length} منتجات ستنتهي خلال 30 يوماً`}</p>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 shadow-sm">
          <div className="p-2.5 bg-[var(--color-primary)]/10 rounded-xl flex-shrink-0">
            <Package size={20} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <p className="font-semibold">{t('total_products_label')}</p>
            <p className="text-2xl font-bold text-[var(--color-primary)]">{stats.totalProducts}</p>
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="p-6 rounded-xl bg-white dark:bg-[#1f2028] shadow-sm border border-black/5 dark:border-white/5">
        <h3 className="text-lg font-semibold mb-6">{t('revenue_vs_profit')}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.monthlyChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e4e7" opacity={0.2} />
              <XAxis dataKey="name" stroke="#888" tick={{ fontSize: 12 }} />
              <YAxis stroke="#888" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text)' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [formatCurrency(Number(value || 0)), '']}
              />
              <Bar dataKey="revenue" name={t('revenue')} fill="#aa3bff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name={t('profit')} fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products */}
      {stats.topProducts.length > 0 && (
        <div className="p-6 rounded-xl bg-white dark:bg-[#1f2028] shadow-sm border border-black/5 dark:border-white/5">
          <h3 className="text-lg font-semibold mb-4">{t('top_selling_products')}</h3>
          <div className="space-y-3">
            {stats.topProducts.map((item, idx) => {
              const maxCount = stats.topProducts[0]?.count || 1;
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={idx} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-5 text-gray-400">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{item.count} {t('units_sold')}</span>
                    </div>
                    <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Products Movement Analytics (On-Demand & Cartons) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Moving Products */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1f2028] shadow-xs border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>أكثر المنتجات طلباً (بالكرتونة)</span>
            </h3>
            <span className="text-[11px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              رائجة 🔥
            </span>
          </div>

          {stats.topMovingProducts.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">لا توجد مبيعات مسجلة حتى الآن</p>
          ) : (
            <div className="space-y-3">
              {stats.topMovingProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 font-black flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600">
                    {p.count} {p.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Least Moving Products */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1f2028] shadow-xs border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>أقل المنتجات حركة</span>
            </h3>
            <span className="text-[11px] text-amber-600 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
              طلب منخفض ⚠️
            </span>
          </div>

          {stats.leastMovingProducts.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">لا توجد بيانات كافية</p>
          ) : (
            <div className="space-y-3">
              {stats.leastMovingProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                  <span className="font-mono text-slate-500">
                    {p.count} {p.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stagnant Products */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1f2028] shadow-xs border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>منتجات لم تتحرك مطلقاً</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              راكدة 0 طلب
            </span>
          </div>

          {stats.stagnantProducts.length === 0 ? (
            <p className="text-xs text-emerald-600 font-bold py-4 text-center">ممتاز! جميع المنتجات تحركت</p>
          ) : (
            <div className="space-y-3">
              {stats.stagnantProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                  <span className="text-[11px] text-slate-400">لم تُطلب بعد</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showZReport && (
        <ZReportModal
          invoices={data.invoices}
          products={data.products}
          onClose={() => setShowZReport(false)}
        />
      )}
      
      {showSubscriptionModal && <SubscriptionModal onClose={() => setShowSubscriptionModal(false)} />}
      
      {showQrModal && <StoreQRCodeModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />}
    </div>
  );
};
