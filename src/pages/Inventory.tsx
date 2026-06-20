import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, AlertTriangle, Trash2, X, Edit3, Download } from 'lucide-react';
import { useDb } from '../database/Provider';
import type { ProductDocType, UnitDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';

interface AdditionalUnit {
  unit_name: string;
  conversion_factor: number;
  price_per_unit: number;
}

export const Inventory = () => {
  const { t, i18n } = useTranslation();
  const db = useDb();

  const [products, setProducts] = useState<ProductDocType[]>([]);
  const [unitsMap, setUnitsMap] = useState<Record<string, UnitDocType[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
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

  // Multi-unit configuration state
  const [additionalUnits, setAdditionalUnits] = useState<AdditionalUnit[]>([]);

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
        setStockQuantity(0);
        setMinSafetyStock(p.min_safety_stock ?? 5);
        
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
    setStockQuantity(0);
    setMinSafetyStock(product.min_safety_stock ?? 5);
    
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
    setStockQuantity(0);
    setMinSafetyStock(5);
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
    if (!nameAr || costPrice <= 0 || salePrice <= 0) return;

    try {
      if (editProductId) {
        // Edit / Replenish mode
        const pDoc = await db.products.findOne(editProductId).exec();
        if (pDoc) {
          const currentStock = pDoc.toJSON().stock_quantity;
          const addedQty = Number(stockQuantity);
          await pDoc.incrementalPatch({
            barcode: barcode || editProductId,
            sku_serial: skuSerial || undefined,
            name_ar: nameAr,
            name_en: nameEn || nameAr,
            category: category || 'General',
            cost_price: Number(costPrice),
            sale_price: Number(salePrice),
            stock_quantity: currentStock + addedQty,
            min_safety_stock: Number(minSafetyStock)
          });

          // Re-save additional units
          const existingUnits = await db.units.find({ selector: { product_id: editProductId } }).exec();
          for (const u of existingUnits) {
            await u.remove();
          }

          for (const unit of additionalUnits) {
            if (unit.unit_name && unit.conversion_factor > 0 && unit.price_per_unit > 0) {
              const unitId = 'unit-' + Math.random().toString(36).substring(2, 9);
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
        const productId = 'prod-' + Math.random().toString(36).substring(2, 9);
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
          min_safety_stock: Number(minSafetyStock)
        });

        for (const unit of additionalUnits) {
          if (unit.unit_name && unit.conversion_factor > 0 && unit.price_per_unit > 0) {
            const unitId = 'unit-' + Math.random().toString(36).substring(2, 9);
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
      setAdditionalUnits([]);
      setEditProductId(null);
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save product:', err);
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
    } catch (err) {
      console.error('Failed to delete product:', err);
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
      p.category || '',
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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold">{t('inventory')}</h2>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder={t('search_barcode')}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-[#1f2028] border border-black/10 dark:border-white/10 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
              filteredProducts.map((p) => {
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
                    <td className="p-4 text-gray-500 text-sm">{p.category}</td>
                    <td className="p-4 font-mono text-sm" dir="ltr">
                      {formatCurrency(p.sale_price)}
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 font-mono text-sm">
                        {p.stock_quantity}
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
                  <label className="block text-sm font-medium mb-1">{t('cost_price_label')}</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    placeholder="0.25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('sale_price_label')}</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={salePrice || ''}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    placeholder="0.50"
                  />
                </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">
                     {editProductId 
                       ? `${t('quantity_to_add')} (${t('current_stock')}: ${products.find(p => p.id === editProductId)?.stock_quantity || 0})`
                       : t('stock')
                     }
                   </label>
                   <input 
                     type="number" 
                     required
                     value={stockQuantity !== undefined ? stockQuantity : ''}
                     onChange={(e) => setStockQuantity(Number(e.target.value))}
                     className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                     placeholder={editProductId ? "0" : "100"}
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
                      <label className="block text-xs font-medium mb-1">{t('conversion_factor_label')}</label>
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
    </div>
  );
};
