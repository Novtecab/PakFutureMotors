// frontend/src/components/cart/CartItem.tsx
import React from 'react';

interface CartItemProps {
  item: {
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl: string;
  };
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemoveItem }) => {
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(e.target.value, 10);
    if (!isNaN(newQuantity) && newQuantity > 0) {
      onUpdateQuantity(item.id, newQuantity);
    }
  };

  return (
    <div className="cart-item flex items-center space-x-4 p-4 border-b last:border-b-0">
      <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded" />
      <div className="flex-grow">
        <h4 className="text-lg font-semibold">{item.name}</h4>
        <p className="text-gray-600">${item.price.toLocaleString()}</p>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={handleQuantityChange}
          className="w-16 p-1 border rounded text-center"
        />
        <button
          onClick={() => onRemoveItem(item.id)}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          aria-label="Remove item"
        >
          Remove
        </button>
      </div>
    </div>
  );
};

export default CartItem;