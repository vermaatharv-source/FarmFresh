import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const CartContext = createContext();

// Must match the backend default in backend/config/platformFee.js.
// The real value is fetched from the server on load; this is only the initial value.
const DEFAULT_PLATFORM_FEE_PERCENT = 30;

const round2 = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round((v + Number.EPSILON) * 100) / 100 : 0;
};

// Drop corrupt / stale entries from localStorage so totals can never become NaN.
const sanitizeCart = (items) =>
  Array.isArray(items)
    ? items.filter(
        (item) =>
          item &&
          item.type === 'FPO' &&
          item.id &&
          Number.isFinite(Number(item.pricePerKg)) &&
          Number.isFinite(Number(item.quantity)) &&
          Number(item.quantity) > 0
      )
    : [];

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('farmfresh_cart');
      // Drop stale farmer-direct items left over from before the farmer portal was removed
      return saved ? sanitizeCart(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('farmfresh_wishlist');
      return saved ? JSON.parse(saved).filter((item) => item.type === 'FPO') : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE_PERCENT);

  useEffect(() => {
    try {
      localStorage.setItem('farmfresh_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('farmfresh_wishlist', JSON.stringify(wishlist));
    } catch (e) {
      console.error('Failed to save wishlist to localStorage', e);
    }
  }, [wishlist]);

  // Read the platform fee from the backend so one PLATFORM_FEE_PERCENT ENV
  // value controls both the cart and checkout displays.
  useEffect(() => {
    let active = true;
    API.get('/orders/platform-fee')
      .then((res) => {
        const percent = Number(res.data?.percent);
        if (active && res.data?.percent !== undefined && res.data?.percent !== null && Number.isFinite(percent) && percent >= 0 && percent <= 100) {
          setPlatformFeePercent(percent);
        }
      })
      .catch(() => {
        // Keep the safe UI fallback; the server remains authoritative at checkout.
      });
    return () => {
      active = false;
    };
  }, []);

  const addToCart = (product, quantity = 1, buyerType = 'INDIVIDUAL') => {
    const minQty = Number(product.minOrderQtyKg || 1);
    const available = Number(product.availableQuantityKg ?? product.quantityAvailable ?? 999);
    const qtyToAdd = Math.round(Math.max(minQty, Number(quantity)) * 10) / 10;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.id === product._id);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        const newQty = Math.min(available, updated[existingIndex].quantity + qtyToAdd);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          buyerType: buyerType || updated[existingIndex].buyerType,
        };
        return updated;
      } else {
        const newItem = {
          id: product._id,
          type: 'FPO',
          name: product.produceType || product.name,
          category: product.category || 'Fresh Produce',
          pricePerKg: Number(product.pricePerKg),
          quantity: Math.min(available, qtyToAdd),
          minOrderQtyKg: minQty,
          availableStock: available,
          imageUrl: product.images?.[0] || product.imageUrl || '',
          grade: product.grade || null,
          seller: product.fpo?.name || 'Verified FPO',
          buyerType: buyerType || 'INDIVIDUAL',
        };
        return [...prevCart, newItem];
      }
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (itemId, newQty) => {
    const qty = Math.round(Number(newQty) * 10) / 10;
    setCart((prevCart) => {
      if (qty <= 0) {
        return prevCart.filter((item) => item.id !== itemId);
      }
      return prevCart.map((item) => {
        if (item.id === itemId) {
          const clamped = Math.min(item.availableStock, Math.max(item.minOrderQtyKg, qty));
          return { ...item, quantity: clamped };
        }
        return item;
      });
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleWishlist = (product) => {
    setWishlist((prev) => {
      const exists = prev.some((item) => item.id === product._id);
      if (exists) {
        return prev.filter((item) => item.id !== product._id);
      } else {
        return [
          ...prev,
          {
            id: product._id,
            type: 'FPO',
            name: product.produceType || product.name,
            category: product.category || 'Fresh Produce',
            pricePerKg: Number(product.pricePerKg),
            minOrderQtyKg: Number(product.minOrderQtyKg || 1),
            availableStock: Number(product.availableQuantityKg ?? product.quantityAvailable ?? 999),
            imageUrl: product.images?.[0] || product.imageUrl || '',
            grade: product.grade || null,
            seller: product.fpo?.name || 'Verified FPO',
          },
        ];
      }
    });
  };

  const isInWishlist = (productId) => {
    return wishlist.some((item) => item.id === productId);
  };

  // Per-item amounts are rounded to paise exactly like the server does
  // (one order per cart item), so the cart total always matches the final charge.
  const itemAmounts = cart.map((item) => round2(Number(item.pricePerKg) * Number(item.quantity)));
  const cartTotal = round2(itemAmounts.reduce((sum, amt) => sum + amt, 0));
  const cartCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const wishlistCount = wishlist.length;
  const platformFee = round2(itemAmounts.reduce((sum, amt) => sum + round2((amt * platformFeePercent) / 100), 0));
  const grandTotal = round2(cartTotal + platformFee);

  return (
    <CartContext.Provider
      value={{
        cart,
        wishlist,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        toggleWishlist,
        isInWishlist,
        cartTotal,
        cartCount,
        wishlistCount,
        platformFeePercent,
        platformFee,
        grandTotal,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}