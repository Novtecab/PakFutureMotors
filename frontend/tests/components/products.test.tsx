// frontend/tests/components/products.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProductCard from '../../src/components/products/ProductCard';
import ProductList from '../../src/components/products/ProductList';
import SearchBar from '../../src/components/products/SearchBar';
import CategoryFilter from '../../src/components/products/CategoryFilter';

// Mock data for testing
const mockProduct = {
  id: '1',
  name: 'Car Model X',
  description: 'A fantastic electric car.',
  price: 50000,
  imageUrl: '/images/car-model-x.jpg',
  category: 'Cars',
  inStock: true,
};

const mockProducts = [
  mockProduct,
  {
    id: '2',
    name: 'Car Wax',
    description: 'High-quality car wax.',
    price: 25,
    imageUrl: '/images/car-wax.jpg',
    category: 'Accessories',
    inStock: true,
  },
];

describe('ProductCard', () => {
  it('renders product information correctly', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('Car Model X')).toBeInTheDocument();
    expect(screen.getByText('A fantastic electric car.')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Car Model X' })).toHaveAttribute('src', '/images/car-model-x.jpg');
  });
});

describe('ProductList', () => {
  it('renders a list of products', () => {
    render(<ProductList products={mockProducts} />);
    expect(screen.getByText('Car Model X')).toBeInTheDocument();
    expect(screen.getByText('Car Wax')).toBeInTheDocument();
  });

  it('renders no products message when list is empty', () => {
    render(<ProductList products={[]} />);
    expect(screen.getByText('No products found.')).toBeInTheDocument();
  });
});

describe('SearchBar', () => {
  it('renders search input', () => {
    render(<SearchBar onSearch={() => {}} />);
    expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument();
  });
});

describe('CategoryFilter', () => {
  const mockCategories = ['Cars', 'Accessories'];
  it('renders category filter buttons', () => {
    render(<CategoryFilter categories={mockCategories} onSelectCategory={() => {}} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Cars')).toBeInTheDocument();
    expect(screen.getByText('Accessories')).toBeInTheDocument();
  });
});