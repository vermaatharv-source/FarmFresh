import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('farmfresh_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('farmfresh_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

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

  const addToCart = (product, quantity = 1, buyerType = 'INDIVIDUAL') => {
    const minQty = Number(product.minOrderQtyKg || 1);
    const available = Number(product.availableQuantityKg ?? product.quantityAvailable ?? 999);
    const qtyToAdd = Math.max(minQty, Number(quantity));

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
          type: product.sourceBatch || product.grade ? 'FPO' : 'DIRECT',
          name: product.produceType || product.name,
          category: product.category || 'Fresh Produce',
          pricePerKg: Number(product.pricePerKg),
          quantity: Math.min(available, qtyToAdd),
          minOrderQtyKg: minQty,
          availableStock: available,
          imageUrl: product.images?.[0] || product.imageUrl || '',
          grade: product.grade || null,
          seller: product.fpo?.name || product.farmerId?.name || 'Verified Farmer',
          buyerType: buyerType || 'INDIVIDUAL',
        };
        return [...prevCart, newItem];
      }
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (itemId, newQty) => {
    const qty = Number(newQty);
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
            type: product.sourceBatch || product.grade ? 'FPO' : 'DIRECT',
            name: product.produceType || product.name,
            category: product.category || 'Fresh Produce',
            pricePerKg: Number(product.pricePerKg),
            minOrderQtyKg: Number(product.minOrderQtyKg || 1),
            availableStock: Number(product.availableQuantityKg ?? product.quantityAvailable ?? 999),
            imageUrl: product.images?.[0] || product.imageUrl || '',
            grade: product.grade || null,
            seller: product.fpo?.name || product.farmerId?.name || 'Verified Farmer',
          },
        ];
      }
    });
  };

  const isInWishlist = (productId) => {
    return wishlist.some((item) => item.id === productId);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.pricePerKg * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistCount = wishlist.length;

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
