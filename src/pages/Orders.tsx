import { useState, useEffect, useMemo } from 'react';
import { useDb } from '../database/Provider';
import type { OrderDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';
import { 
  ClipboardList, Search, CheckCircle, Clock, Truck, 
  ShoppingBag, XCircle, ChevronDown, ChevronUp, Edit3, 
  Phone, MapPin, MessageCircle, Calendar, Save
} from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  new: { label: 'جديد', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/30', icon: Clock },
  confirmed: { label: 'مؤكد', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/30', icon: CheckCircle },
  purchased: { label: 'تم الشراء من المورد', color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/30', icon: ShoppingBag },
  delivering: { label: 'قيد التوصيل', color: 'text-indigo-600', bg: 'bg-indigo-500/10 border-indigo-500/30', icon: Truck },
  completed: { label: 'مكتمل', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle },
  cancelled: { label: 'ملغي', color: 'text-rose-600', bg: 'bg-rose-500/10 border-rose-500/30', icon: XCircle }
};

export const Orders = () => {
  const db = useDb();
  const [orders, setOrders] = useState<OrderDocType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Edit Actual Cost Modal or inline editing
  const [editingActualCosts, setEditingActualCosts] = useState<Record<string, number>>({});
  const [savingCost, setSavingCost] = useState(false);

  useEffect(() => {
    if (!db) return;
    const sub = db.orders.find().sort({ created_at: 'desc' }).$.subscribe(docs => {
      setOrders(docs.map(d => d.toJSON()));
    });
    return () => sub.unsubscribe();
  }, [db]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      const matchSearch = !searchTerm.trim() || 
        ord.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ord.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ord.customer_phone.includes(searchTerm);
      const matchStatus = statusFilter === 'all' || ord.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // Status counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach(o => {
      c[o.status] = (c[o.status] || 0) + 1;
    });
    return c;
  }, [orders]);

  // Update order status
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const doc = await db.orders.findOne(orderId).exec();
      if (doc) {
        await doc.incrementalPatch({ status: newStatus });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('فشل في تحديث حالة الطلب');
    }
  };

  // Start editing actual costs
  const startCostEditing = (order: OrderDocType) => {
    const map: Record<string, number> = {};
    order.items.forEach((item, idx) => {
      map[`${order.order_id}_${idx}`] = item.actual_cost_price !== undefined ? item.actual_cost_price : item.cost_price;
    });
    setEditingActualCosts(prev => ({ ...prev, ...map }));
  };

  // Save actual costs and recalculate profit
  const handleSaveActualCosts = async (order: OrderDocType) => {
    setSavingCost(true);
    try {
      let totalActualCost = 0;
      const updatedItems = order.items.map((item, idx) => {
        const costKey = `${order.order_id}_${idx}`;
        const actualCost = editingActualCosts[costKey] !== undefined ? editingActualCosts[costKey] : item.cost_price;
        totalActualCost += (actualCost * item.quantity);
        return {
          ...item,
          actual_cost_price: actualCost
        };
      });

      const updatedProfit = order.total_amount - totalActualCost;

      const doc = await db.orders.findOne(order.order_id).exec();
      if (doc) {
        await doc.incrementalPatch({
          items: updatedItems,
          actual_cost: totalActualCost,
          profit: updatedProfit,
          // If was new/confirmed, auto-advance to purchased if user enters actual purchase cost
          status: (order.status === 'new' || order.status === 'confirmed') ? 'purchased' : order.status
        });
      }
      alert('تم تحديث سعر الشراء الفعلي وحساب الربح بنجاح');
    } catch (err) {
      console.error('Failed to update actual cost:', err);
      alert('فشل في حفظ سعر الشراء الفعلي');
    } finally {
      setSavingCost(false);
    }
  };

  // Quick WhatsApp message to customer
  const sendCustomerWhatsApp = (order: OrderDocType) => {
    const cleanPhone = order.customer_phone.replace(/[^0-9]/g, '');
    let msg = `مرحباً ${order.customer_name}، بخصوص طلبك رقم (${order.order_number}) من متجرنا: `;
    if (order.status === 'confirmed') msg += `تم تأكيد طلبك وجارٍ تجهيزه من المخزن.`;
    else if (order.status === 'purchased') msg += `تم تجهيز المنتجات وسيتم التوصيل قريباً.`;
    else if (order.status === 'delivering') msg += `الطلب الآن في الطريق إليك مع المندوب.`;
    else if (order.status === 'completed') msg += `تم تسليم الطلب، شكراً لتعاملك معنا ونتطلع لخدمتك دائماً.`;
    else msg += `نحن نتواصل معك لتأكيد تفاصيل الطلب والتوصيل.`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-purple-600" size={26} />
            <span>إدارة الطلبات والمبيعات</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            متابعة طلبات الزبائن، الشراء من الموردين حسب الطلب، وتحديد الربح الفعلي
          </p>
        </div>

        {/* Quick WhatsApp Store Preview */}
        <div className="flex items-center gap-2">
          <a
            href="/store"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <span>عرض متجر الزبائن</span>
            <span className="text-purple-200">↗</span>
          </a>
        </div>
      </div>

      {/* Status Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-3 rounded-xl border text-center transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="text-xs font-semibold">الكل</div>
          <div className="text-lg font-black mt-0.5">{counts.all || 0}</div>
        </button>

        {Object.entries(STATUS_MAP).map(([key, info]) => {
          const count = counts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                statusFilter === key
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-300'
              }`}
            >
              <div className="text-xs font-semibold truncate">{info.label}</div>
              <div className="text-lg font-black mt-0.5">{count}</div>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث برقم الطلب، اسم الزبون، أو رقم الهاتف..."
          className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm shadow-xs"
        />
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <ClipboardList className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={40} />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">لا توجد طلبات في هذا القسم</h3>
          <p className="text-xs text-slate-400 mt-1">عندما يقوم الزبائن بطلب منتجات ستظهر هنا فوراً</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => {
            const isExpanded = expandedOrderId === order.order_id;
            const statusConfig = STATUS_MAP[order.status] || STATUS_MAP.new;
            const StatusIcon = statusConfig.icon;
            const actualCost = (order.actual_cost ?? order.estimated_cost) || 0;
            const profit = (order.total_amount || 0) - actualCost;

            return (
              <div
                key={order.order_id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition"
              >
                {/* Order Summary Header */}
                <div
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.order_id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  {/* Left: Number, Customer, Date */}
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-mono font-black shrink-0">
                      #{order.order_number.replace('ORD-', '')}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">
                          {order.customer_name}
                        </h3>
                        <span className="text-xs text-slate-400 font-mono">
                          {order.order_number}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.color}`}>
                          <StatusIcon size={12} />
                          {statusConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone size={12} />
                          {order.customer_phone}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(order.created_at).toLocaleDateString('ar-EG', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        {order.customer_address && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 truncate max-w-xs">
                              <MapPin size={12} />
                              {order.customer_address}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Financials and Status Quick Dropdown */}
                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">إجمالي البيع</div>
                      <div className="text-base font-black text-slate-900 dark:text-white">
                        {formatCurrency(order.total_amount)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-purple-600 font-medium">الربح المقدر</div>
                      <div className="text-base font-black text-emerald-600">
                        +{formatCurrency(profit)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-6">
                    {/* Status Step Bar */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        تحديث حالة الطلب:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(STATUS_MAP).map(([key, info]) => {
                          const isCurrent = order.status === key;
                          return (
                            <button
                              key={key}
                              onClick={() => handleUpdateStatus(order.order_id, key)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                                isCurrent
                                  ? `${info.bg} ${info.color} ring-2 ring-purple-500`
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                              }`}
                            >
                              <info.icon size={13} />
                              {info.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer Notes */}
                    {order.notes && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-xs">
                        <strong>ملاحظة الزبون: </strong> {order.notes}
                      </div>
                    )}

                    {/* Items List with Secret Cost & Actual Cost Input */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <ShoppingBag size={14} className="text-purple-600" />
                          <span>المنتجات المطلوبة وحساب تكلفة الشراء من المورد:</span>
                        </h4>
                        <button
                          onClick={() => startCostEditing(order)}
                          className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 size={13} />
                          <span>تعديل سعر الشراء الفعلي</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="p-3">المنتج</th>
                              <th className="p-3">الكمية</th>
                              <th className="p-3">سعر البيع</th>
                              <th className="p-3">إجمالي البيع</th>
                              <th className="p-3 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
                                سعر الشراء الفعلي من المورد (سري)
                              </th>
                              <th className="p-3 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
                                تكلفة الشراء
                              </th>
                              <th className="p-3 font-bold text-emerald-600">الربح</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {order.items.map((item, idx) => {
                              const costKey = `${order.order_id}_${idx}`;
                              const currentCost = editingActualCosts[costKey] !== undefined
                                ? editingActualCosts[costKey]
                                : (item.actual_cost_price !== undefined ? item.actual_cost_price : item.cost_price);
                              
                              const itemSaleTotal = item.sale_price * item.quantity;
                              const itemCostTotal = currentCost * item.quantity;
                              const itemProfit = itemSaleTotal - itemCostTotal;

                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                                    {item.name}
                                  </td>
                                  <td className="p-3 font-mono font-bold">
                                    {item.quantity} {item.unit}
                                  </td>
                                  <td className="p-3 font-mono">
                                    {formatCurrency(item.sale_price)}
                                  </td>
                                  <td className="p-3 font-mono font-bold">
                                    {formatCurrency(itemSaleTotal)}
                                  </td>
                                  <td className="p-3 bg-purple-50/30 dark:bg-purple-950/10">
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        step="any"
                                        value={currentCost}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          setEditingActualCosts(prev => ({
                                            ...prev,
                                            [costKey]: val
                                          }));
                                        }}
                                        className="w-24 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                      />
                                      <span className="text-[11px] text-slate-400">/{item.unit}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono text-purple-700 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-950/10 font-bold">
                                    {formatCurrency(itemCostTotal)}
                                  </td>
                                  <td className="p-3 font-mono font-black text-emerald-600">
                                    +{formatCurrency(itemProfit)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-400">إجمالي المبيعات: </span>
                          <span className="text-slate-900 dark:text-white font-mono text-sm">
                            {formatCurrency(order.total_amount)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-400">تكلفة الشراء الفعلية: </span>
                          <span className="text-purple-600 font-mono text-sm">
                            {formatCurrency(actualCost)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                          <span>الربح الإجمالي الصافي: </span>
                          <span className="font-mono text-sm font-black">
                            +{formatCurrency(profit)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* Save actual costs button */}
                        <button
                          onClick={() => handleSaveActualCosts(order)}
                          disabled={savingCost}
                          className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Save size={14} />
                          <span>حفظ تكلفة الشراء والربح</span>
                        </button>

                        {/* WhatsApp Customer */}
                        <button
                          onClick={() => sendCustomerWhatsApp(order)}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <MessageCircle size={14} />
                          <span>مراسلة الزبون</span>
                        </button>

                        {/* Direct Call */}
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                          title="اتصال هاتفي"
                        >
                          <Phone size={15} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
