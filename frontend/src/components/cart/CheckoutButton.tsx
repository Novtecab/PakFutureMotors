// frontend/src/components/cart/CheckoutButton.tsx
import React from 'react';

interface CheckoutButtonProps {
  onCheckout: () => void;
  disabled?: boolean;
}

const CheckoutButton: React.FC<CheckoutButtonProps> = ({ onCheckout, disabled = false }) => {
  return (
    <button
      onClick={onCheckout}
      disabled={disabled}
      className={`w-full px-4 py-3 rounded-lg text-white font-semibold text-lg ${
        disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
      }`}
    >
      Proceed to Checkout
    </button>
  );
};

export default CheckoutButton;