// frontend/src/components/products/CategoryFilter.tsx
import React from 'react';

interface CategoryFilterProps {
  categories: string[];
  onSelectCategory: (category: string | null) => void;
  selectedCategory?: string | null;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ categories, onSelectCategory, selectedCategory }) => {
  return (
    <div className="category-filter flex flex-wrap gap-2 p-4">
      <button
        onClick={() => onSelectCategory(null)}
        className={`px-4 py-2 rounded-lg ${
          selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelectCategory(category)}
          className={`px-4 py-2 rounded-lg ${
            selectedCategory === category ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;