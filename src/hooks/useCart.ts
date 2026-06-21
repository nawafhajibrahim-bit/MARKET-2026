import { useState } from 'react';
import type { ProductDocType, UnitDocType } from '../database/schema';

export interface CartItem {
  product: ProductDocType;
  selectedUnit: UnitDocType | null;
  quantity: number;
}

export function useCart(
  unitsMap: Record<string, UnitDocType[]>,
  triggerNotification: (text: string, type: 'success' | 'error') => void,
  t: (key: string) => string
) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const getProductQtyInCart = (productId: string, excludeIndex?: number) => {
    return cart.reduce((sum, item, idx) => {
      if (item.product.id !== productId || idx === excludeIndex) return sum;
      const factor = item.selectedUnit ? item.selectedUnit.conversion_factor : 1;
      return sum + (item.quantity * factor);
    }, 0);
  };

  const handleAddToCart = (product: ProductDocType) => {
    if (product.stock_quantity <= 0) {
      triggerNotification(t('sale_failed') + ` (${t('out_of_stock')})`, 'error');
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id && item.selectedUnit === null);
    const currentBaseQty = getProductQtyInCart(product.id);
    const newBaseQty = currentBaseQty + 1;

    if (newBaseQty > product.stock_quantity) {
      triggerNotification(t('quantity_exceeds_stock'), 'error');
      return;
    }

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, selectedUnit: null, quantity: 1 }]);
    }
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, change: number) => {
    const updated = [...cart];
    const item = updated[index];
    const newQty = item.quantity + change;
    if (newQty > 0) {
      if (change > 0) {
        const factor = item.selectedUnit ? item.selectedUnit.conversion_factor : 1;
        const currentOtherBaseQty = getProductQtyInCart(item.product.id, index);
        const newTotalBaseQty = currentOtherBaseQty + (newQty * factor);

        if (newTotalBaseQty > item.product.stock_quantity) {
          triggerNotification(t('quantity_exceeds_stock'), 'error');
          return;
        }
      }
      item.quantity = newQty;
      setCart(updated);
    }
  };

  const handleUnitChangeInCart = (index: number, unitId: string) => {
    const updated = [...cart];
    const item = updated[index];
    const prodUnits = unitsMap[item.product.id] || [];
    
    let targetUnit = null;
    if (unitId !== 'base') {
      const foundUnit = prodUnits.find(u => u.unit_id === unitId);
      if (foundUnit) {
        targetUnit = foundUnit;
      }
    }

    const factor = targetUnit ? targetUnit.conversion_factor : 1;
    const currentOtherBaseQty = getProductQtyInCart(item.product.id, index);
    const newTotalBaseQty = currentOtherBaseQty + (item.quantity * factor);

    if (newTotalBaseQty > item.product.stock_quantity) {
      triggerNotification(t('quantity_exceeds_stock'), 'error');
      return;
    }

    item.selectedUnit = targetUnit;
    setCart(updated);
  };

  const calculateCartTotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.selectedUnit ? item.selectedUnit.price_per_unit : item.product.sale_price;
      return sum + (price * item.quantity);
    }, 0);
  };

  const clearCart = () => {
    setCart([]);
  };

  return {
    cart,
    setCart,
    handleAddToCart,
    handleRemoveFromCart,
    handleQuantityChange,
    handleUnitChangeInCart,
    calculateCartTotal,
    clearCart
  };
}
