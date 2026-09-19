import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, AlertTriangle, Trash2, X, Edit3, Download, Camera, Info } from 'lucide-react';
import { useDb } from '../database/Provider';
import type { ProductDocType, UnitDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';
import { CameraScannerModal } from '../components/CameraScannerModal';

interface AdditionalUnit {
  unit_name: string;
  conversion_factor: number;
  price_per_unit: number;
}

export const Inventory = () => {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const isAr = i18n.language === 'ar';

  const [products, setProducts] = useState<ProductDocType[]>([]);
  const [unitsMap, setUnitsMap] = useState<Record<string, UnitDocType[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [skuSerial, setSkuSerial] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('');
  const [costPrice, setCostPrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [minSafetyStock, setMinSafetyStock] = useState(5);
  const [expiryDate, setExpiryDate] = useState('');
  const [unit, setUnit] = useState<string>('piece');
  const [editStockMode, setEditStockMode] = useState<'replenish' | 'direct'>('replenish');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Multi-unit configuration state
  const [additionalUnits, setAdditionalUnits] = useState<AdditionalUnit[]>([]);

  // Notification Toast State
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const triggerNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleBarcodeChange = async (val: string) => {
    setBarcode(val);
    if (val && !editProductId) {
      const existing = await db.products.findOne({ selector: { barcode: val } }).exec();
      if (existing) {
        const p = existing.toJSON();
        setEditProductId(p.id);
        setSkuSerial(p.sku_serial || '');
        setNameAr(p.name_ar);
        setNameEn(p.name_en || '');
        setCategory(p.category || '');
        setCostPrice(p.cost_price);
        setSalePrice(p.sale_price);
        setEditStockMode('replenish');
        setStockQuantity(0);
        setMinSafetyStock(p.min_safety_stock ?? 5);
        setExpiryDate(p.expiry_date || '');
        setUnit(p.unit || 'piece');
        
        const units = await db.units.find({ selector: { product_id: p.id } }).exec();
        setAdditionalUnits(units.map(u => {
          const ut = u.toJSON();
          return {
            unit_name: ut.unit_name,
            conversion_factor: ut.conversion_factor,
            price_per_unit: ut.price_per_unit
          };
        }));
      }
    }
  };

  const handleOpenEdit = async (product: ProductDocType) => {
    setEditProductId(product.id);
    setBarcode(product.barcode || '');
    setSkuSerial(product.sku_serial || '');
    setNameAr(product.name_ar);
    setNameEn(product.name_en || '');
    setCategory(product.category || '');
    setCostPrice(product.cost_price);
    setSalePrice(product.sale_price);
    setEditStockMode('replenish');
    setStockQuantity(0);
    setMinSafetyStock(product.min_safety_stock ?? 5);
    setExpiryDate(product.expiry_date || '');
    setUnit(product.unit || 'piece');
    
    const units = await db.units.find({ selector: { product_id: product.id } }).exec();
    setAdditionalUnits(units.map(u => {
      const ut = u.toJSON();
      return {
        unit_name: ut.unit_name,
        conversion_factor: ut.conversion_factor,
        price_per_unit: ut.price_per_unit
      };
    }));
    setShowModal(true);
  };

  const handleOpenAdd = () => {
    setEditProductId(null);
    setBarcode('');
    setSkuSerial('');
    setNameAr('');
    setNameEn('');
    setCategory('');
    setCostPrice(0);
    setSalePrice(0);
    setEditStockMode('replenish');
    setStockQuantity(0);
    setMinSafetyStock(5);
    setExpiryDate('');
    setUnit('piece');
    setAdditionalUnits([]);
    setShowModal(true);
  };

  // Fetch and subscribe to products & units reactively
  useEffect(() => {
    const productsSub = db.products.find().$.subscribe(async (docs) => {
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

  const handleAddUnitRow = () => {
    setAdditionalUnits([...additionalUnits, { unit_name: '', conversion_factor: 1, price_per_unit: 0 }]);
  };

  const handleRemoveUnitRow = (index: number) => {
    setAdditionalUnits(additionalUnits.filter((_, i) => i !== index));
  };

  const handleUnitChange = (index: number, field: keyof AdditionalUnit, value: string | number) => {
    const updated = additionalUnits.map((u, i) => {
      if (i === index) {
        return { ...u, [field]: value };
      }
      return u;
    });
    setAdditionalUnits(updated);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Detailed input validation
    if (!nameAr.trim()) {
      triggerNotification(
        i18n.language === 'ar' ? 'الاسم بالعربية مطلوب!' : 'Arabic name is required!',
        'error'
      );
      return;
    }

    if (Number(costPrice) <= 0) {
      triggerNotification(
        i18n.language === 'ar' ? 'سعر التكلفة يجب أن يكون أكبر من صفر!' : 'Cost price must be greater than zero!',
        'error'
      );
      return;
    }

    if (Number(salePrice) <= 0) {
      triggerNotification(
        i18n.language === 'ar' ? 'سعر البيع يجب أن يكون أكبر من صفر!' : 'Sale price must be greater than zero!',
        'error'
      );
      return;
    }

    for (const unit of additionalUnits) {
      if (!unit.unit_name.trim()) {
        triggerNotification(
          i18n.language === 'ar' ? 'اسم الوحدة الإضافية مطلوب!' : 'Additional unit name is required!',
          'error'
        );
        return;
      }
      if (Number(unit.conversion_factor) <= 0) {
        triggerNotification(
          i18n.language === 'ar' ? 'معامل التحويل يجب أن يكون أكبر من صفر!' : 'Conversion factor must be greater than zero!',
          'error'
        );
        return;
      }
      if (Number(unit.price_per_unit) <= 0) {
        triggerNotification(
          i18n.language === 'ar' ? 'سعر بيع الوحدة يجب أن يكون أكبر من صفر!' : 'Unit sale price must be greater than zero!',
          'error'
        );
        return;
      }
    }

    try {
      if (editProductId) {
        // Edit / Replenish mode
        const pDoc = await db.products.findOne(editProductId).exec();
        if (pDoc) {
          const currentStock = pDoc.toJSON().stock_quantity;
          const finalStock = editStockMode === 'replenish' 
            ? currentStock + Number(stockQuantity) 
            : Number(stockQuantity);

          if (finalStock < 0) {
            triggerNotification(
              isAr ? 'لا يمكن أن يكون المخزون النهائي سالباً!' : 'Final stock cannot be negative!',
              'error'
            );
            return;
          }

          await pDoc.incrementalPatch({
            barcode: barcode || editProductId,
            sku_serial: skuSerial || undefined,
            name_ar: nameAr,
            name_en: nameEn || nameAr,
            category: category || 'General',
            cost_price: Number(costPrice),
            sale_price: Number(salePrice),
            stock_quantity: finalStock,
            min_safety_stock: Number(minSafetyStock),
            expiry_date: expiryDate || undefined,
            unit: unit
          });

          // Re-save additional units
          const existingUnits = await db.units.find({ selector: { product_id: editProductId } }).exec();
          for (const u of existingUnits) {
            await u.remove();
          }

          for (const unit of additionalUnits) {
            if (unit.unit_name && unit.conversion_factor > 0 && unit.price_per_unit > 0) {
              const unitId = 'unit-' + crypto.randomUUID();
              await db.units.insert({
                unit_id: unitId,
                product_id: editProductId,
                unit_name: unit.unit_name,
                conversion_factor: Number(unit.conversion_factor),
                price_per_unit: Number(unit.price_per_unit)
              });
            }
          }
        }
      } else {
        // Insert mode
        const productId = 'prod-' + crypto.randomUUID();
        await db.products.insert({
          id: productId,
          barcode: barcode || productId,
          sku_serial: skuSerial || undefined,
          name_ar: nameAr,
          name_en: nameEn || nameAr,
          category: category || 'General',
          cost_price: Number(costPrice),
          sale_price: Number(salePrice),
          stock_quantity: Number(stockQuantity),
          min_safety_stock: Number(minSafetyStock),
          expiry_date: expiryDate || undefined,
          unit: unit
        });

        for (const unit of additionalUnits) {
          if (unit.unit_name && unit.conversion_factor > 0 && unit.price_per_unit > 0) {
            const unitId = 'unit-' + crypto.randomUUID();
            await db.units.insert({
              unit_id: unitId,
              product_id: productId,
              unit_name: unit.unit_name,
              conversion_factor: Number(unit.conversion_factor),
              price_per_unit: Number(unit.price_per_unit)
            });
          }
        }
      }

      // Reset Form & Close Modal
      setBarcode('');
      setSkuSerial('');
      setNameAr('');
      setNameEn('');
      setCategory('');
      setCostPrice(0);
      setSalePrice(0);
      setStockQuantity(0);
      setMinSafetyStock(5);
      setExpiryDate('');
      setUnit('piece');
      setAdditionalUnits([]);
      setEditProductId(null);
      setShowModal(false);

      triggerNotification(
        i18n.language === 'ar' ? 'تم حفظ المنتج بنجاح!' : 'Product saved successfully!',
        'success'
      );
    } catch (err) {
      console.error('Failed to save product:', err);
      triggerNotification(
        i18n.language === 'ar' ? 'فشل حفظ المنتج!' : 'Failed to save product!',
        'error'
      );
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const doc = await db.products.findOne(id).exec();
      if (doc) await doc.remove();
      
      // Remove associated units
      const associatedUnits = await db.units.find({ selector: { product_id: id } }).exec();
      for (const u of associatedUnits) {
        await u.remove();
      }

      triggerNotification(
        i18n.language === 'ar' ? 'تم حذف المنتج بنجاح!' : 'Product deleted successfully!',
        'success'
      );
    } catch (err) {
      console.error('Failed to delete product:', err);
      triggerNotification(
        i18n.language === 'ar' ? 'فشل حذف المنتج!' : 'Failed to delete product!',
        'error'
      );
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const query = searchTerm.toLowerCase();
    return (
      p.barcode?.toLowerCase().includes(query) ||
      p.name_ar?.toLowerCase().includes(query) ||
      p.name_en?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportProductsToCSV = () => {
    const headers = [
      t('barcode'),
      'SKU',
      t('product_name') + ' (AR)',
      t('product_name') + ' (EN)',
      t('category'),
      t('cost_price_label'),
      t('sale_price_label'),
      t('current_stock')
    ];

    const rows = products.map(p => [
      p.barcode || '',
      p.sku_serial || '',
      p.name_ar,
      p.name_en || '',
      (p.category === 'General' || p.category === 'general') ? t('general') : (p.category || ''),
      p.cost_price,
      p.sale_price,
      p.stock_quantity
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold">{t('inventory')}</h2>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3 text-gray-400 pointer-events-none" size={18} />
            <input 
              type="text" 
              placeholder={t('search_barcode')}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171d] focus:border-[var(--color-primary)] outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              onClick={() => setShowCameraScanner(true)}
              className="absolute right-2 p-1.5 text-gray-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors cursor-pointer"
              title={isAr ? "مسح بالكاميرا" : "Scan with camera"}
            >
              <Camera size={18} />
            </button>
          </div>
          <button 
            onClick={exportProductsToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all font-medium cursor-pointer"
            title={t('export_csv')}
          >
            <Download size={18} />
            <span className="hidden sm:inline">{t('export_csv')}</span>
          </button>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:brightness-110 active:scale-95 transition-all font-medium cursor-pointer"
          >
            <Plus size={18} />
            {t('new_item')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1f2028] rounded-xl border border-black/5 dark:border-white/5 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
          <thead>
            <tr className="bg-black/5 dark:bg-white/5 text-sm uppercase tracking-wider text-gray-500">
              <th className="p-4 font-medium">{t('barcode')}</th>
              <th className="p-4 font-medium">{t('product_name')}</th>
              <th className="p-4 font-medium">{t('category')}</th>
              <th className="p-4 font-medium">{t('price')}</th>
              <th className="p-4 font-medium text-center">{t('stock')}</th>
              <th className="p-4 font-medium text-center">{t('status')}</th>
              <th className="p-4 font-medium text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  {t('no_products_found')}
                </td>
              </tr>
            ) : (
              paginatedProducts.map((p) => {
                const isAr = i18n.language === 'ar';
                const displayName = isAr ? p.name_ar : p.name_en;
                const associatedUnits = unitsMap[p.id] || [];

                return (
                  <tr key={p.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono text-sm">{p.barcode}</td>
                    <td className="p-4 font-medium">
                      <div>
                        <div>{displayName}</div>
                        {associatedUnits.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
                            {associatedUnits.map((u, i) => (
                              <span key={i} className="bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
                                {u.unit_name} (x{u.conversion_factor}) : {formatCurrency(u.price_per_unit)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                     <td className="p-4 text-gray-500 text-sm">{(p.category === 'General' || p.category === 'general') ? t('general') : p.category}</td>
                    <td className="p-4 font-mono text-sm" dir="ltr">
                      {formatCurrency(p.sale_price)}
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 font-mono text-sm gap-1">
                        {p.stock_quantity} <span className="text-[10px] text-gray-500 font-sans">{t(`unit_${p.unit || 'piece'}`, { defaultValue: p.unit || 'piece' })}</span>
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {p.stock_quantity <= (p.min_safety_stock ?? 0) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-full font-medium">
                          <AlertTriangle size={12} /> {t('low_stock')}
                        </span>
                      ) : (
                        <span className="inline-flex text-xs text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full font-medium">
                          {t('good')}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => handleOpenEdit(p)}
                          className="text-[var(--color-primary)] hover:text-purple-700 p-1 hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 p-4 bg-white dark:bg-[#1f2028] rounded-xl shadow-sm border border-black/5 dark:border-white/5 select-none">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-semibold hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {i18n.language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <span className="text-sm font-medium text-gray-500">
            {i18n.language === 'ar' 
              ? `الصفحة ${currentPage} من ${totalPages}` 
              : `Page ${currentPage} of ${totalPages}`
            }
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-semibold hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {i18n.language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      {/* Add Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-black/10 dark:border-white/10 p-6 flex flex-col">
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/5 dark:border-white/5">
               <h3 className="text-xl font-bold">{editProductId ? t('replenish_edit_product_title') : t('add_product_title')}</h3>
               <button 
                 onClick={() => setShowModal(false)}
                 className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
               >
                 <X size={20} />
               </button>
             </div>
 
             <form onSubmit={handleSaveProduct} className="space-y-6 flex-1">
               {editProductId && (
                 <div className="bg-blue-500/10 text-blue-500 border border-blue-500/20 p-3.5 rounded-xl text-sm font-semibold flex items-center gap-2">
                   <span>ℹ️</span>
                   <span>{t('replenish_mode_notice')}</span>
                 </div>
               )}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium mb-1">{t('barcode')}</label>
                   <input 
                     type="text" 
                     value={barcode}
                     onChange={(e) => handleBarcodeChange(e.target.value)}
                     disabled={!!editProductId}
                     className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none disabled:opacity-50"
                     placeholder="123456789"
                   />
                 </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SKU / Serial (Optional)</label>
                  <input 
                    type="text" 
                    value={skuSerial}
                    onChange={(e) => setSkuSerial(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    placeholder="SN-XXXX"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">{t('product_name')}</label>
                  <input 
                    type="text" 
                    required
                    value={nameAr}
                    onChange={(e) => {
                      setNameAr(e.target.value);
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    placeholder={i18n.language === 'ar' ? 'ماء معدني 500 مل' : 'Mineral Water 500ml'}
                  />
                </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">{t('category')}</label>
                   <input 
                     type="text" 
                     value={category}
                     onChange={(e) => setCategory(e.target.value)}
                     className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                     placeholder="Drinks"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">{t('base_unit_label')}</label>
                   <select 
                     value={unit}
                     onChange={(e) => setUnit(e.target.value)}
                     className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer"
                   >
                     <option value="piece">{t('unit_piece')}</option>
                     <option value="kg">{t('unit_kg')}</option>
                     <option value="gram">{t('unit_gram')}</option>
                     <option value="liter">{t('unit_liter')}</option>
                     <option value="ml">{t('unit_ml')}</option>
                     <option value="box">{t('unit_box')}</option>
                     <option value="carton">{t('unit_carton')}</option>
                     <option value="bag">{t('unit_bag')}</option>
                     <option value="meter">{t('unit_meter')}</option>
                   </select>
                 </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('cost_price_label')}</label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    required
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('sale_price_label')}</label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    required
                    value={salePrice || ''}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none font-mono"
                    placeholder="0.00"
                  />
                </div>

                {/* Live Profit Preview */}
                {(costPrice > 0 || salePrice > 0) && (
                  <div className="md:col-span-2 py-2 px-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-500">{t('profit_per_unit')}:</span>
                      <span className={`font-bold font-mono text-sm ${
                        (salePrice - costPrice) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                      }`} dir="ltr">
                        {formatCurrency(salePrice - costPrice)}
                      </span>
                    </div>
                    {salePrice > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-500">{t('profit_margin')}:</span>
                        <span className={`font-bold font-mono ${
                          (salePrice - costPrice) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                        }`} dir="ltr">
                          {(((salePrice - costPrice) / salePrice) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {costPrice > 0 && salePrice > 0 && salePrice < costPrice && (
                      <span className="text-red-500 font-semibold text-[11px]">
                        ⚠️ {isAr ? 'تنبيه: سعر البيع أقل من سعر الشراء بالجملة!' : 'Warning: Sale price is less than wholesale cost!'}
                      </span>
                    )}
                  </div>
                )}

                <div className="md:col-span-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-1 flex items-start gap-2">
                  <div className="text-blue-500 mt-0.5">
                    <Info size={16} />
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    <strong className="font-bold">{isAr ? 'تنبيه لضبط الأرباح:' : 'Pricing Tip:'}</strong> {isAr ? 'تأكد أن سعر الشراء وسعر البيع يمثلان تسعيرة الوحدة الأساسية المختارة، وعند البيع يحسب النظام الأرباح بدقة متناهية.' : 'Make sure purchase and sale prices represent the base unit chosen.'}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="block text-sm font-medium">
                      {editProductId 
                        ? (editStockMode === 'replenish' 
                            ? `${t('quantity_to_add')} (${t('current_stock')}: ${products.find(p => p.id === editProductId)?.stock_quantity || 0})`
                            : `${t('stock')} (${t('current_stock')}: ${products.find(p => p.id === editProductId)?.stock_quantity || 0})`)
                        : t('stock')
                      }
                    </label>
                    {editProductId && (
                      <div className="flex gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setEditStockMode('replenish');
                            setStockQuantity(0);
                          }}
                          className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                            editStockMode === 'replenish'
                              ? 'bg-[var(--color-primary)] text-white shadow-xs'
                              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          {t('stock_mode_replenish')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const curr = products.find(p => p.id === editProductId)?.stock_quantity || 0;
                            setEditStockMode('direct');
                            setStockQuantity(curr);
                          }}
                          className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                            editStockMode === 'direct'
                              ? 'bg-[var(--color-primary)] text-white shadow-xs'
                              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          {t('stock_mode_direct')}
                        </button>
                      </div>
                    )}
                  </div>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={stockQuantity !== undefined ? stockQuantity : ''}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none font-mono"
                    placeholder={editProductId ? (editStockMode === 'replenish' ? "0" : "100") : "100"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('safety_stock_label')}</label>
                  <input 
                    type="number" 
                    required
                    value={minSafetyStock}
                    onChange={(e) => setMinSafetyStock(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('expiry_date_label') || 'تاريخ الانتهاء'}</label>
                  <input 
                    type="date" 
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>

              {/* Multi unit section */}
              <div className="border-t border-black/5 dark:border-white/5 pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">{t('additional_units_label')}</h4>
                  <button 
                    type="button"
                    onClick={handleAddUnitRow}
                    className="text-xs bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1.5 rounded-lg font-medium hover:bg-[var(--color-primary)]/20 transition-all cursor-pointer"
                  >
                    {t('add_unit_row')}
                  </button>
                </div>

                {additionalUnits.map((unit, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-black/5 dark:bg-white/5 p-3 rounded-xl relative">
                    <div>
                      <label className="block text-xs font-medium mb-1">{t('unit_name_label')}</label>
                      <input 
                        type="text" 
                        required
                        value={unit.unit_name}
                        onChange={(e) => handleUnitChange(index, 'unit_name', e.target.value)}
                        placeholder="Box"
                        className="w-full px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-[#1f2028] border border-transparent focus:border-[var(--color-primary)] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        {t('conversion_factor_label_dynamic', { unit: t(`unit_${unit}`, { defaultValue: unit }) })}
                      </label>
                      <input 
                        type="number" 
                        required
                        value={unit.conversion_factor || ''}
                        onChange={(e) => handleUnitChange(index, 'conversion_factor', Number(e.target.value))}
                        placeholder="24"
                        className="w-full px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-[#1f2028] border border-transparent focus:border-[var(--color-primary)] outline-none"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1">{t('unit_price_label')}</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={unit.price_per_unit || ''}
                          onChange={(e) => handleUnitChange(index, 'price_per_unit', Number(e.target.value))}
                          placeholder="10.00"
                          className="w-full px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-[#1f2028] border border-transparent focus:border-[var(--color-primary)] outline-none"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleRemoveUnitRow(index)}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer mt-6"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:brightness-110 active:scale-95 transition-all font-semibold cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-black/10 dark:border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500/10 rounded-xl">
                <Trash2 className="text-red-500" size={22} />
              </div>
              <h3 className="text-lg font-bold">{t('delete_confirm_title')}</h3>
            </div>
            <p className="text-gray-500 mb-6">{t('delete_confirm_desc')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-5 py-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => handleDeleteProduct(deleteConfirmId)}
                className="px-5 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 active:scale-95 transition-all cursor-pointer"
              >
                {t('delete_confirm_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {message && (
        <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:w-96 text-white p-4 rounded-xl shadow-lg z-[300] flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${
          messageType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          <span>{messageType === 'success' ? '✅' : '⚠️'}</span>
          <span>{message}</span>
        </div>
      )}

      {showCameraScanner && (
        <CameraScannerModal 
          onScan={(barcode) => {
            setSearchTerm(barcode);
          }} 
          onClose={() => setShowCameraScanner(false)} 
        />
      )}
    </div>
  );
};
