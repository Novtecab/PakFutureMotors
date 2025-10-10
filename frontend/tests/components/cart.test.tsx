// frontend/tests/components/cart.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CartItem from '../../src/components/cart/CartItem';
import CartSummary from '../../src/components/cart/CartSummary';
import CartDropdown from '../../src/components/cart/CartDropdown';
import CheckoutButton from '../../src/components/cart/CheckoutButton';

// Mock data for testing
const mockCartItem = {
  id: 'ci1',
  productId: 'p1',
  name: 'Car Model X',
  price: 50000,
  quantity: 1,
  imageUrl: '/images/car-model-x.jpg',
};

const mockCartItems = [
  mockCartItem,
  {
    id: 'ci2',
    productId: 'p2',
    name: 'Car Wax',
    price: 25,
    quantity: 2,
    imageUrl: '/images/car-wax.jpg',
  },
];

describe('CartItem', () => {
  it('renders cart item information correctly', () => {
    const onUpdateQuantity = vi.fn();
    const onRemoveItem = vi.fn();
    render(<CartItem item={mockCartItem} onUpdateQuantity={onUpdateQuantity} onRemoveItem={onRemoveItem} />);

    expect(screen.getByText('Car Model X')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Car Model X' })).toHaveAttribute('src', '/images/car-model-x.jpg');
  });

  it('calls onUpdateQuantity when quantity changes', () => {
    const onUpdateQuantity = vi.fn();
    const onRemoveItem = vi.fn();
    render(<CartItem item={mockCartItem} onUpdateQuantity={onUpdateQuantity} onRemoveItem={onRemoveItem} />);

    const quantityInput = screen.getByDisplayValue('1');
    fireEvent.change(quantityInput, { target: { value: '2' } });
    expect(onUpdateQuantity).toHaveBeenCalledWith('ci1', 2);
  });

  it('calls onRemoveItem when remove button is clicked', () => {
    const onUpdateQuantity = vi.fn();
    const onRemoveItem = vi.fn();
    render(<CartItem item={mockCartItem} onUpdateQuantity={onUpdateQuantity} onRemoveItem={onRemoveItem} />);

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemoveItem).toHaveBeenCalledWith('ci1');
  });
});

describe('CartSummary', () => {
  it('renders total price correctly', () => {
    render(<CartSummary items={mockCartItems} />);
    expect(screen.getByText('Total:')).toBeInTheDocument();
    expect(screen.getByText('$50,050')).toBeInTheDocument(); // 50000 * 1 + 25 * 2 = 50050
  });

  it('renders empty cart message', () => {
    render(<CartSummary items={[]} />);
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });
});

describe('CartDropdown', () => {
  it('renders cart items and summary', () => {
    const onUpdateQuantity = vi.fn();
    const onRemoveItem = vi.fn();
    render(
      <CartDropdown
        items={mockCartItems}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={() => {}}
      />
    );

    expect(screen.getByText('Car Model X')).toBeInTheDocument();
    expect(screen.getByText('Car Wax')).toBeInTheDocument();
    expect(screen.getByText('$50,050')).toBeInTheDocument();
  });

  it('renders empty message when no items', () => {
    const onUpdateQuantity = vi.fn();
    const onRemoveItem = vi.fn();
    render(
      <CartDropdown
        items={[]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={() => {}}
      />
    );
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });
});

describe('CheckoutButton', () => {
  it('renders checkout button and calls onCheckout', () => {
    const onCheckout = vi.fn();
    render(<CheckoutButton onCheckout={onCheckout} />);
    const button = screen.getByRole('button', { name: /checkout/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });
});