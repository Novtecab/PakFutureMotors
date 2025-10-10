// frontend/src/components/cart/CartDropdown.tsx
import React from 'react';
import CartItem from './CartItem';
import CartSummary from './CartSummary';
import CheckoutButton from './CheckoutButton';

interface CartDropdownProps {
  items: Array<{
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl: string;
  }>;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
}

const CartDropdown: React.FC<CartDropdownProps> = ({ items, onUpdateQuantity, onRemoveItem, onCheckout }) => {
  return (
    <div className="cart-dropdown absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
      <div className="p-4">
        <h3 className="text-xl font-bold mb-4">Your Cart</h3>
        {items.length === 0 ? (
          <p className="text-center text-gray-500">Your cart is empty.</p>
        ) : (
          <div className="space-y-4 max-h-60 overflow-y-auto">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
              />
            ))}
          </div>
        )}
        <CartSummary items={items} />
        <div className="mt-4">
          <CheckoutButton onCheckout={onCheckout} disabled={items.length === 0} />
        </div>
      </div>
    </div>
  );
};

export default CartDropdown;