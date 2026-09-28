import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '../database/Provider';
import type { SupplierDocType, ProductDocType } from '../database/schema';
import { 
  Truck, Plus, Search, Phone, MessageCircle, Store, 
  Trash2, Edit3, X, Package
} from 'lucide-react';

export const Suppliers = () => {
  const db = useDb();
  const [suppliers, setSuppliers] = useState<SupplierDocType[]>([]);
  const [products, setProducts] = useState<ProductDocType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [storeName, setStoreName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load suppliers and products
  useEffect(() => {
    if (!db) return;
    const subSupp = db.suppliers.find().$.subscribe(docs => {
      setSuppliers(docs.map(d => d.toJSON()));
    });
    const subProd = db.products.find().$.subscribe(docs => {
      setProducts(docs.map(d => d.toJSON()));
    });
    return () => {
      subSupp.unsubscribe();
      subProd.unsubscribe();
    };
  }, [db]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      return !searchTerm.trim() || 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.store_name && s.store_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.phone && s.phone.includes(searchTerm));
    });
  }, [suppliers, searchTerm]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditSupplierId(null);
    setName('');
    setPhone('');
    setWhatsapp('');
    setStoreName('');
    setNotes('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (supplier: SupplierDocType) => {
    setEditSupplierId(supplier.supplier_id);
    setName(supplier.name);
    setPhone(supplier.phone || '');
    setWhatsapp(supplier.whatsapp || '');
    setStoreName(supplier.store_name || '');
    setNotes(supplier.notes || '');
    setShowModal(true);
  };

  // Save Supplier
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editSupplierId) {
        const doc = await db.suppliers.findOne(editSupplierId).exec();
        if (doc) {
          await doc.incrementalPatch({
            name: name.trim(),
            phone: phone.trim(),
            whatsapp: whatsapp.trim() || phone.trim(),
            store_name: storeName.trim(),
            notes: notes.trim(),
          });
        }
      } else {
        const newId = 'supp:' + Date.now().toString(36);
        await db.suppliers.insert({
          supplier_id: newId,
          name: name.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || phone.trim(),
          store_name: storeName.trim(),
          notes: notes.trim(),
          created_at: new Date().toISOString()
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save supplier:', err);
      alert('حدث خطأ أثناء حفظ بيانات المورد');
    } finally {
      setSaving(false);
    }
  };

  // Delete Supplier
  const handleDelete = async (supplierId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المورد؟')) return;
    try {
      const doc = await db.suppliers.findOne(supplierId).exec();
      if (doc) {
        await doc.remove();
      }
    } catch (err) {
      console.error('Failed to delete supplier:', err);
      alert('فشل في حذف المورد');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="text-purple-600" size={26} />
            <span>موردو الجملة والمخازن</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            دليل الموردين والمتاجر التي تشتري منها المنتجات حسب الطلب، والتواصل السريع معهم
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Plus size={16} />
          <span>إضافة مورد جديد</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث عن مورد، مخزن، أو رقم هاتف..."
          className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm shadow-xs"
        />
      </div>

      {/* Suppliers Grid */}
      {filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Truck className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={40} />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">لا يوجد موردون مسجلون</h3>
          <p className="text-xs text-slate-400 mt-1">أضف موردي الجملة والمخازن لسهولة التواصل والشراء عند الطلب</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSuppliers.map(supplier => {
            // Find products associated with this supplier
            const supplierProducts = products.filter(p => 
              p.supplier_id === supplier.supplier_id || p.supplier_name === supplier.name
            );

            const cleanPhone = (supplier.whatsapp || supplier.phone || '').replace(/[^0-9]/g, '');

            return (
              <div
                key={supplier.supplier_id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-purple-300 transition flex flex-col justify-between"
              >
                <div>
                  {/* Supplier Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                        <Store size={22} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">
                          {supplier.name}
                        </h3>
                        {supplier.store_name && (
                          <p className="text-xs text-purple-600 font-medium">
                            {supplier.store_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(supplier)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="تعديل"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.supplier_id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Phone & Contact Details */}
                  <div className="mt-4 space-y-2 text-xs">
                    {supplier.phone && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Phone size={12} />
                          الهاتف:
                        </span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          {supplier.phone}
                        </span>
                      </div>
                    )}

                    {supplier.notes && (
                      <p className="text-slate-500 dark:text-slate-400 text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <strong>ملاحظات:</strong> {supplier.notes}
                      </p>
                    )}
                  </div>

                  {/* Associated Products */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-2">
                      <Package size={13} className="text-purple-500" />
                      منتجات أشتريها منه ({supplierProducts.length}):
                    </span>

                    {supplierProducts.length === 0 ? (
                      <span className="text-[11px] text-slate-400">
                        لا توجد منتجات مربوطة بهذا المورد حالياً
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {supplierProducts.map(p => (
                          <span
                            key={p.id}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                          >
                            {p.name_ar} ({p.unit || 'كرتونة'})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Contact Buttons */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  {cleanPhone ? (
                    <>
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                      >
                        <MessageCircle size={15} />
                        <span>واتساب المورد</span>
                      </a>
                      <a
                        href={`tel:${supplier.phone}`}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                        title="اتصال"
                      >
                        <Phone size={15} />
                      </a>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400">لم يتم إدخال رقم هاتف</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">
                {editSupplierId ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المورد / المسؤول *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أبو أحمد، الحاج مصطفى"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المتجر أو المخزن
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="مثال: مخازن البركة للجملة"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 07501234567"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم واتساب
                  </label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="إذا كان مختلفاً"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات وتفاصيل التوريد
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات حول الأسعار، مواعيد التوصيل، الخصومات..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 active:scale-95 transition cursor-pointer"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
