// frontend/src/components/products/ProductList.tsx
import React from 'react';
import ProductCard from './ProductCard';

interface ProductListProps {
  products: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    category: string;
    inStock: boolean;
  }>;
}

const ProductList: React.FC<ProductListProps> = ({ products }) => {
  if (products.length === 0) {
    return <p className="text-center text-gray-500">No products found.</p>;
  }

  return (
    <div className="product-list grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};

export default ProductList;