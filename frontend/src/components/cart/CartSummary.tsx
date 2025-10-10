// frontend/src/components/cart/CartSummary.tsx
import React from 'react';

interface CartSummaryProps {
  items: Array<{
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

const CartSummary: React.FC<CartSummaryProps> = ({ items }) => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="cart-summary p-4 border-t mt-4">
        <p className="text-center text-gray-500">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="cart-summary p-4 border-t mt-4">
      <div className="flex justify-between items-center text-xl font-bold">
        <span>Total:</span>
        <span>${subtotal.toLocaleString()}</span>
      </div>
      {/* Additional summary details like shipping, tax can be added here */}
    </div>
  );
};

export default CartSummary;