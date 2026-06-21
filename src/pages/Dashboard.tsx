import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, HandCoins, AlertTriangle, ShoppingCart, Package } from 'lucide-react';
import { useDb } from '../database/Provider';
import type { InvoiceDocType, DebtDocType, ProductDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';

const AIEngine = React.lazy(() => import('../modules/ai/AIEngine'));

export const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const [aiEnabled, setAiEnabled] = useState(false);
  const [data, setData] = useState<{
    invoices: InvoiceDocType[];
    debts: DebtDocType[];
    products: ProductDocType[];
  }>({
    invoices: [],
    debts: [],
    products: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAi = () => setAiEnabled(localStorage.getItem('ai_enabled') === 'true');
    checkAi();
    window.addEventListener('storage', checkAi);
    return () => window.removeEventListener('storage', checkAi);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const [invoiceDocs, debtDocs, productDocs] = await Promise.all([
          db.invoices.find().exec(),
          db.debts.find().exec(),
          db.products.find().exec(),
        ]);

        if (isMounted) {
          setData({
            invoices: invoiceDocs.map(d => d.toJSON()),
            debts: debtDocs.map(d => d.toJSON()),
            products: productDocs.map(d => d.toJSON()),
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

    return () => {
      isMounted = false;
      invoicesSub.unsubscribe();
      debtsSub.unsubscribe();
      productsSub.unsubscribe();
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
          productSaleCount[item.product_id] = (productSaleCount[item.product_id] || 0) + item.quantity;
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

    return {
      todayRevenue,
      monthRevenue,
      totalProfit,
      pendingDebts,
      lowStockCount,
      totalProducts: products.length,
      monthlyChart,
      topProducts,
    };
  }, [data, t, i18n.language]);

  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('dashboard')}</h2>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-3 h-3 rounded-full bg-[var(--color-primary)] animate-pulse" />
            {t('loading')}
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#1f2028] shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">{t('today_revenue')}</span>
            <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg">
              <ShoppingCart size={16} className="text-[var(--color-primary)]" />
            </div>
          </div>
          <p className="text-2xl font-bold" dir="ltr">{fmt(stats.todayRevenue)}</p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#1f2028] shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">{t('month_revenue')}</span>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp size={16} className="text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-500" dir="ltr">{fmt(stats.monthRevenue)}</p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#1f2028] shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">{t('real_profit')}</span>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingDown size={16} className="text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-500" dir="ltr">{fmt(stats.totalProfit)}</p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#1f2028] shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">{t('active_debts')}</span>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <HandCoins size={16} className="text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-500" dir="ltr">{fmt(stats.pendingDebts)}</p>
        </div>
      </div>

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

      {aiEnabled && (
        <React.Suspense fallback={<div className="p-4 text-center">{t('ai_loading')}</div>}>
          <AIEngine />
        </React.Suspense>
      )}
    </div>
  );
};
