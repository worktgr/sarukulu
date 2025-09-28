// CartContext.js
import { createContext, useContext, useMemo, useState, useCallback } from 'react';

/**
 * Item shape:
 * {
 *   variantId: string | number,
 *   name: string,
 *   label?: string,  // e.g. "1L", "500ml"
 *   price: number,   // per unit
 *   qty: number
 * }
 */

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  const addItem = useCallback(({ variantId, name, label, price, qty = 1 }) => {
    if (!variantId) return;
    const q = Number(qty) || 1;
    const p = Number(price) || 0;

    setItems(prev => {
      const i = prev.findIndex(it => it.variantId === variantId);
      if (i !== -1) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + q };
        return next;
      }
      return [...prev, { variantId, name, label, price: p, qty: q }];
    });
  }, []);

  const setQty = useCallback((variantId, qty) => {
    const q = Math.max(0, Number(qty) || 0);
    setItems(prev => {
      const i = prev.findIndex(it => it.variantId === variantId);
      if (i === -1) return prev;
      const next = [...prev];
      if (q === 0) next.splice(i, 1);
      else next[i] = { ...next[i], qty: q };
      return next;
    });
  }, []);

  const removeItem = useCallback((variantId) => {
    setItems(prev => prev.filter(it => it.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const { subtotal, totalItems } = useMemo(() => {
    const s = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
    const t = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    return { subtotal: Number(s.toFixed(2)), totalItems: t };
  }, [items]);

  const value = useMemo(() => ({
    items,
    addItem,
    setQty,
    removeItem,
    clear,
    subtotal,
    totalItems,
  }), [items, addItem, setQty, removeItem, clear, subtotal, totalItems]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
