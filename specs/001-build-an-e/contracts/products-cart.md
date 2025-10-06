# API Contracts: Products & Cart

## Product Catalog Endpoints

### GET /api/products
**Purpose**: List products with filtering and search

**Query Parameters**:
```typescript
{
  category?: 'cars' | 'accessories' | 'parts' | 'tools';
  subcategory?: string;
  search?: string; // search in name, description, keywords
  brand?: string;
  min_price?: number;
  max_price?: number;
  featured?: boolean;
  page?: number; // default 1
  limit?: number; // default 20, max 100
  sort?: 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'created_desc';
}
```

**Response**:
```typescript
{
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  filters: {
    categories: { value: string; count: number }[];
    brands: { value: string; count: number }[];
    price_range: { min: number; max: number };
  };
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  sale_price?: number;
  currency: string;
  stock_quantity: number;
  in_stock: boolean;
  images: ProductImage[];
  brand: string;
  model?: string;
  year?: integer;
  slug: string;
  tags: string[];
  featured: boolean;
}
```

### GET /api/products/:id
**Purpose**: Get single product details

**Response**:
```typescript
{
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  sale_price?: number;
  currency: string;
  stock_quantity: number;
  in_stock: boolean;
  images: ProductImage[];
  documents: ProductDocument[];
  brand: string;
  model?: string;
  year?: number;
  specifications: Record<string, any>;
  slug: string;
  tags: string[];
  search_keywords: string[];
  featured: boolean;
  related_products: Product[]; // simplified product objects
}
```

### GET /api/products/search/suggestions
**Purpose**: Search autocomplete suggestions

**Query Parameters**:
```typescript
{
  q: string; // search term
  limit?: number; // default 10
}
```

**Response**:
```typescript
{
  suggestions: {
    products: { id: string; name: string; category: string }[];
    categories: string[];
    brands: string[];
  };
}
```

## Shopping Cart Endpoints

### GET /api/cart
**Purpose**: Get current cart contents
**Auth**: Optional (guest carts supported)

**Response**:
```typescript
{
  id: string;
  items: CartItem[];
  subtotal: number;
  currency: string;
  item_count: number;
  expires_at: string; // ISO timestamp
}

interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    price: number;
    sale_price?: number;
    currency: string;
    images: ProductImage[];
    in_stock: boolean;
    stock_quantity: number;
  };
  quantity: number;
  line_total: number;
  added_at: string;
}
```

### POST /api/cart/items
**Purpose**: Add item to cart
**Auth**: Optional

**Request**:
```typescript
{
  product_id: string;
  quantity: number; // default 1, min 1
}
```

**Response**: Updated cart (same as GET /api/cart)

### PUT /api/cart/items/:item_id
**Purpose**: Update cart item quantity
**Auth**: Optional

**Request**:
```typescript
{
  quantity: number; // min 1
}
```

**Response**: Updated cart

### DELETE /api/cart/items/:item_id
**Purpose**: Remove item from cart
**Auth**: Optional

**Response**: Updated cart

### DELETE /api/cart
**Purpose**: Clear entire cart
**Auth**: Optional

**Response**:
```typescript
{
  success: boolean;
}
```

### POST /api/cart/merge
**Purpose**: Merge guest cart with user cart after login
**Auth**: Required

**Request**:
```typescript
{
  guest_cart_id?: string;
}
```

**Response**: Merged cart (same as GET /api/cart)

## Product Management (Admin) Endpoints

### POST /api/admin/products
**Purpose**: Create new product
**Auth**: Admin required

**Request**:
```typescript
{
  sku: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  sale_price?: number;
  stock_quantity: number;
  brand: string;
  model?: string;
  year?: number;
  specifications?: Record<string, any>;
  tags?: string[];
  search_keywords?: string[];
  featured?: boolean;
}
```

**Response**: Created product

### PUT /api/admin/products/:id
**Purpose**: Update product
**Auth**: Admin required

**Request**: Same as POST (all fields optional)
**Response**: Updated product

### DELETE /api/admin/products/:id
**Purpose**: Soft delete product
**Auth**: Admin required

**Response**:
```typescript
{
  success: boolean;
}
```

### POST /api/admin/products/:id/images
**Purpose**: Upload product images
**Auth**: Admin required

**Request**: Multipart form data with image files
**Response**:
```typescript
{
  images: ProductImage[];
}
```

## Error Responses

### Product-Specific Error Codes
- `PRODUCT_NOT_FOUND`: Product does not exist
- `PRODUCT_OUT_OF_STOCK`: Requested quantity exceeds stock
- `INVALID_QUANTITY`: Quantity must be positive integer
- `CART_NOT_FOUND`: Cart does not exist or expired
- `CART_ITEM_NOT_FOUND`: Item not in cart
- `SKU_ALREADY_EXISTS`: Product SKU already exists (admin)
- `INSUFFICIENT_STOCK`: Not enough inventory for requested quantity