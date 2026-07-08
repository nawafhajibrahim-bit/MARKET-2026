import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckCircle, Clock, AlertTriangle, Package, Trash2, X } from 'lucide-react';
import { useDb } from '../database/Provider';
import type { PurchaseDocType, ProductDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';

export const Purchases = () => {
  const { i18n } = useTranslation();
  const db = useDb();
  const isAr = i18n.language.startsWith('ar');

  const [purchases, setPurchases] = useState<PurchaseDocType[]>([]);
  const [products, setProducts] = useState<ProductDocType[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New Purchase State
  const [supplierName, setSupplierName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<Array<{ product_id: string; name: string; quantity: number; cost_price: number; subtotal: number }>>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load Data
  useEffect(() => {
    const sub = db.purchases.find().sort({ date: 'desc' }).$.subscribe(docs => {
      setPurchases(docs.map(d => d.toJSON()));
    });
    const subProd = db.products.find().$.subscribe(docs => {
      setProducts(docs.map(d => d.toJSON()));
    });
    return () => {
      sub.unsubscribe();
      subProd.unsubscribe();
    };
  }, [db]);

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleAddItem = (productId: string) => {
    if (!productId) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    
    // Check if already in list
    if (items.some(i => i.product_id === productId)) return;

    setItems([...items, {
      product_id: prod.id,
      name: isAr ? prod.name_ar : (prod.name_en || prod.name_ar),
      quantity: 1,
      cost_price: prod.cost_price || 0,
      subtotal: prod.cost_price || 0
    }]);
  };

  const updateItem = (index: number, field: 'quantity' | 'cost_price', value: number) => {
    const newItems = [...items];
    newItems[index][field] = value;
    newItems[index].subtotal = newItems[index].quantity * newItems[index].cost_price;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert(isAr ? 'يجب إضافة منتج واحد على الأقل' : 'Must add at least one item');
      return;
    }
    if (!supplierName) {
      alert(isAr ? 'يجب إدخال اسم المورد' : 'Supplier name is required');
      return;
    }

    setSaving(true);
    try {
      const remainingAmount = totalAmount - paidAmount;
      let status = 'unpaid';
      if (remainingAmount <= 0) status = 'paid';
      else if (paidAmount > 0) status = 'partial';

      const purchaseId = 'pur:' + Date.now().toString(36);

      // 1. Save Purchase Record
      await db.purchases.insert({
        purchase_id: purchaseId,
        supplier_name: supplierName,
        date: new Date(purchaseDate).toISOString(),
        items: items,
        total_amount: totalAmount,
        paid_amount: Number(paidAmount),
        remaining_amount: remainingAmount > 0 ? remainingAmount : 0,
        status,
        notes
      });

      // 2. Update Product Stock and Cost Price
      for (const item of items) {
        const prodDoc = await db.products.findOne(item.product_id).exec();
        if (prodDoc) {
          const currentStock = prodDoc.stock_quantity || 0;
          await prodDoc.incrementalPatch({
            stock_quantity: currentStock + item.quantity,
            cost_price: item.cost_price // Update to the latest cost price
          });
        }
      }

      // 3. Register Debt if not fully paid
      if (remainingAmount > 0) {
        await db.debts.insert({
          debt_id: 'debt:' + Date.now().toString(36),
          client_supplier_name: supplierName,
          phone: '',
          type: 'Supplier Credit',
          amount: remainingAmount,
          paid_amount: 0,
          due_date: '',
          status: 'Pending',
          created_at: new Date().toISOString()
        });
      }

      setShowAddModal(false);
      setSupplierName('');
      setItems([]);
      setPaidAmount(0);
      setNotes('');
      alert(isAr ? 'تم حفظ الفاتورة وتحديث المخزون بنجاح' : 'Purchase saved and stock updated successfully');
    } catch (err) {
      console.error(err);
      alert(isAr ? 'حدث خطأ أثناء الحفظ' : 'Error saving purchase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isAr ? 'المشتريات والموردين' : 'Purchases & Suppliers'}</h1>
          <p className="text-gray-500 mt-1">
            {isAr ? 'إدارة فواتير الشراء وإضافة المخزون تلقائياً' : 'Manage purchase invoices and auto-update stock'}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[var(--color-primary)] hover:brightness-110 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all shadow-md shadow-purple-500/20"
        >
          <Plus size={20} />
          <span>{isAr ? 'فاتورة مشتريات جديدة' : 'New Purchase'}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#1f2028] border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
        {purchases.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <Package size={64} className="opacity-20 mb-4" />
            <p className="text-lg font-semibold">{isAr ? 'لا توجد فواتير مشتريات بعد' : 'No purchases yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10">
                <tr>
                  <th className="p-4 font-bold">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="p-4 font-bold">{isAr ? 'المورد' : 'Supplier'}</th>
                  <th className="p-4 font-bold">{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className="p-4 font-bold">{isAr ? 'المدفوع' : 'Paid'}</th>
                  <th className="p-4 font-bold">{isAr ? 'المتبقي (دين)' : 'Remaining'}</th>
                  <th className="p-4 font-bold">{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {purchases.map(p => (
                  <tr key={p.purchase_id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="p-4 font-bold text-[var(--color-primary)]">{p.supplier_name}</td>
                    <td className="p-4 font-mono font-bold">{formatCurrency(p.total_amount)}</td>
                    <td className="p-4 font-mono text-green-600 dark:text-green-400">{formatCurrency(p.paid_amount)}</td>
                    <td className="p-4 font-mono text-red-600 dark:text-red-400">{formatCurrency(p.remaining_amount)}</td>
                    <td className="p-4">
                      {p.status === 'paid' ? (
                        <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 font-bold text-xs flex items-center gap-1 w-fit">
                          <CheckCircle size={14} /> {isAr ? 'خالص' : 'Paid'}
                        </span>
                      ) : p.status === 'partial' ? (
                        <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 font-bold text-xs flex items-center gap-1 w-fit">
                          <Clock size={14} /> {isAr ? 'دفع جزئي' : 'Partial'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 font-bold text-xs flex items-center gap-1 w-fit">
                          <AlertTriangle size={14} /> {isAr ? 'آجل' : 'Unpaid'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2028] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Package className="text-[var(--color-primary)]" />
                {isAr ? 'فاتورة مشتريات جديدة' : 'New Purchase Invoice'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">{isAr ? 'اسم المورد' : 'Supplier Name'}</label>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    placeholder={isAr ? 'شركة المراعي, مستودع الجملة...' : 'Supplier Name...'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{isAr ? 'تاريخ الفاتورة' : 'Invoice Date'}</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>

              <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl space-y-4">
                <div className="flex gap-2">
                  <select 
                    className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-[#16171d] border border-black/10 dark:border-white/10 outline-none"
                    onChange={(e) => {
                      handleAddItem(e.target.value);
                      e.target.value = '';
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>{isAr ? 'اختر منتجاً لإضافته للفاتورة...' : 'Select product to add...'}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{isAr ? p.name_ar : (p.name_en || p.name_ar)}</option>
                    ))}
                  </select>
                </div>

                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-[#16171d] rounded-lg border border-black/5 dark:border-white/5">
                        <div className="flex-1 min-w-[200px] font-bold">{item.name}</div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">{isAr ? 'الكمية' : 'Qty'}</span>
                            <input 
                              type="number" min="0.01" step="any"
                              value={item.quantity || ''}
                              onChange={e => updateItem(index, 'quantity', Number(e.target.value))}
                              className="w-20 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 outline-none bg-black/5 dark:bg-white/5 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">{isAr ? 'التكلفة للوحدة' : 'Unit Cost'}</span>
                            <input 
                              type="number" min="0" step="any"
                              value={item.cost_price || ''}
                              onChange={e => updateItem(index, 'cost_price', Number(e.target.value))}
                              className="w-24 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 outline-none bg-black/5 dark:bg-white/5 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">{isAr ? 'المجموع' : 'Subtotal'}</span>
                            <div className="w-24 px-3 py-1.5 font-bold font-mono text-sm text-[var(--color-primary)]">
                              {formatCurrency(item.subtotal)}
                            </div>
                          </div>
                          <div className="mt-5">
                            <button onClick={() => removeItem(index)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[var(--color-primary)] text-white p-4 rounded-xl flex flex-col justify-center items-center shadow-md">
                  <span className="text-sm opacity-80">{isAr ? 'إجمالي الفاتورة' : 'Total Amount'}</span>
                  <span className="text-2xl font-black font-mono">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex flex-col justify-center">
                  <label className="text-sm text-green-700 dark:text-green-400 font-bold mb-1">{isAr ? 'المبلغ المدفوع' : 'Paid Amount'}</label>
                  <input
                    type="number" min="0" max={totalAmount} step="any"
                    value={paidAmount || ''}
                    onChange={e => setPaidAmount(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg border border-green-500/30 outline-none bg-white dark:bg-black/20 font-mono font-bold text-green-600 dark:text-green-400"
                  />
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col justify-center items-center">
                  <span className="text-sm text-red-700 dark:text-red-400 font-bold mb-1">{isAr ? 'المبلغ المتبقي (آجل)' : 'Remaining (Debt)'}</span>
                  <span className="text-xl font-black font-mono text-red-600 dark:text-red-400">
                    {formatCurrency(Math.max(0, totalAmount - paidAmount))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none min-h-[80px]"
                  placeholder={isAr ? 'ملاحظات إضافية على الفاتورة...' : 'Additional notes...'}
                />
              </div>

            </div>
            
            <div className="p-6 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex justify-end gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2.5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={handleSavePurchase}
                disabled={saving || items.length === 0}
                className="px-8 py-2.5 bg-[var(--color-primary)] hover:brightness-110 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all"
              >
                {saving ? '...' : (isAr ? 'حفظ واعتماد الفاتورة' : 'Save Invoice')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
