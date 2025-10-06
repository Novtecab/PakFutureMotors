/**
 * T008: Products & Cart Contract Tests
 * Tests product catalog and shopping cart functionality from products-cart.md
 */
import request from 'supertest';
import app from '../../src/app';

describe('Products & Cart Contract Tests', () => {
  let accessToken: string;
  let productId: string;
  let cartId: string;

  beforeEach(async () => {
    // Register and login a test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'product@example.com',
        password: 'SecurePass123!',
        first_name: 'Product',
        last_name: 'Test',
        auth_provider: 'email'
      });

    accessToken = userResponse.body.tokens.access_token;

    // Create a test product
    const productResponse = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'TEST-CAR-001',
        name: 'Test Car Model',
        description: 'A premium test vehicle',
        category: 'cars',
        price: 25000.00,
        stock_quantity: 5,
        brand: 'TestBrand',
        model: 'TestModel',
        year: 2024
      });

    productId = productResponse.body.id;
  });

  describe('GET /api/products', () => {
    it('should list products with filtering', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({
          category: 'cars',
          page: 1,
          limit: 20,
          sort: 'price_asc'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('filters');
      
      expect(Array.isArray(response.body.products)).toBe(true);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 20);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('total_pages');
      
      expect(response.body.filters).toHaveProperty('categories');
      expect(response.body.filters).toHaveProperty('brands');
      expect(response.body.filters).toHaveProperty('price_range');
    });

    it('should search products', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({
          search: 'Test Car',
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.products.length).toBeGreaterThan(0);
      
      const product = response.body.products[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('category');
      expect(product).toHaveProperty('in_stock');
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({
          min_price: 20000,
          max_price: 30000
        });

      expect(response.status).toBe(200);
      response.body.products.forEach((product: any) => {
        expect(product.price).toBeGreaterThanOrEqual(20000);
        expect(product.price).toBeLessThanOrEqual(30000);
      });
    });

    it('should filter by brand', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({
          brand: 'TestBrand'
        });

      expect(response.status).toBe(200);
      response.body.products.forEach((product: any) => {
        expect(product.brand).toBe('TestBrand');
      });
    });

    it('should show only featured products', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({
          featured: true
        });

      expect(response.status).toBe(200);
      response.body.products.forEach((product: any) => {
        expect(product.featured).toBe(true);
      });
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get single product details', async () => {
      const response = await request(app)
        .get(`/api/products/${productId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', productId);
      expect(response.body).toHaveProperty('sku');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('specifications');
      expect(response.body).toHaveProperty('images');
      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('related_products');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('GET /api/products/search/suggestions', () => {
    it('should return search suggestions', async () => {
      const response = await request(app)
        .get('/api/products/search/suggestions')
        .query({
          q: 'test',
          limit: 5
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('suggestions');
      expect(response.body.suggestions).toHaveProperty('products');
      expect(response.body.suggestions).toHaveProperty('categories');
      expect(response.body.suggestions).toHaveProperty('brands');
      
      expect(Array.isArray(response.body.suggestions.products)).toBe(true);
      expect(Array.isArray(response.body.suggestions.categories)).toBe(true);
      expect(Array.isArray(response.body.suggestions.brands)).toBe(true);
    });
  });

  describe('Shopping Cart Management', () => {
    describe('GET /api/cart', () => {
      it('should get empty cart for new user', async () => {
        const response = await request(app)
          .get('/api/cart')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('items', []);
        expect(response.body).toHaveProperty('subtotal', 0);
        expect(response.body).toHaveProperty('item_count', 0);
        expect(response.body).toHaveProperty('expires_at');
      });

      it('should work for guest users', async () => {
        const response = await request(app)
          .get('/api/cart');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('items');
      });
    });

    describe('POST /api/cart/items', () => {
      it('should add item to cart', async () => {
        const response = await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            product_id: productId,
            quantity: 2
          });

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        
        const item = response.body.items[0];
        expect(item.product.id).toBe(productId);
        expect(item.quantity).toBe(2);
        expect(item).toHaveProperty('line_total');
        expect(item).toHaveProperty('added_at');
        
        expect(response.body.subtotal).toBeGreaterThan(0);
        expect(response.body.item_count).toBe(2);
      });

      it('should return 400 for invalid product', async () => {
        const response = await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            product_id: 'invalid-product-id',
            quantity: 1
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
      });

      it('should return 400 for insufficient stock', async () => {
        const response = await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            product_id: productId,
            quantity: 100 // More than available stock
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
      });

      it('should return 400 for invalid quantity', async () => {
        const response = await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            product_id: productId,
            quantity: 0
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_QUANTITY');
      });
    });

    describe('PUT /api/cart/items/:item_id', () => {
      let itemId: string;

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            product_id: productId,
            quantity: 1
          });

        itemId = response.body.items[0].id;
      });

      it('should update cart item quantity', async () => {
        const response = await request(app)
          .put(`/api/cart/items/${itemId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            quantity: 3
          });

        expect(response.status).toBe(200);
        
        const item = response.body.items.find((i: any) => i.id === itemId);
        expect(item.quantity).toBe(3);
        expect(response.body.item_count).toBe(3);
      });

      it('should return 404 for non-existent item', async () => {
        const response = await request(app)
          .put('/api/cart/items/non-existent-item')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            quantity: 2
          });

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('CART_ITEM_NOT_FOUND');
      });
    });

    describe('DELETE /api/cart/items/:item_id', () => {
      let itemId: string;

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            product_id: productId,
            quantity: 2
          });

        itemId = response.body.items[0].id;
      });

      it('should remove item from cart', async () => {
        const response = await request(app)
          .delete(`/api/cart/items/${itemId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(0);
        expect(response.body.subtotal).toBe(0);
        expect(response.body.item_count).toBe(0);
      });
    });

    describe('DELETE /api/cart', () => {
      beforeEach(async () => {
        await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            product_id: productId,
            quantity: 1
          });
      });

      it('should clear entire cart', async () => {
        const response = await request(app)
          .delete('/api/cart')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('POST /api/cart/merge', () => {
      it('should merge guest cart with user cart', async () => {
        // Create guest cart first
        const guestCartResponse = await request(app)
          .post('/api/cart/items')
          .send({
            product_id: productId,
            quantity: 1
          });

        const guestCartId = guestCartResponse.body.id;

        // Merge with user cart
        const response = await request(app)
          .post('/api/cart/merge')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            guest_cart_id: guestCartId
          });

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].quantity).toBe(1);
      });
    });
  });

  describe('Admin Product Management', () => {
    it('should create new product', async () => {
      const productData = {
        sku: 'ADMIN-TEST-001',
        name: 'Admin Test Product',
        description: 'Product created by admin',
        category: 'accessories',
        price: 150.00,
        stock_quantity: 10,
        brand: 'AdminBrand',
        featured: true,
        tags: ['test', 'admin'],
        search_keywords: ['admin', 'test', 'accessory']
      };

      const response = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(productData);

      expect(response.status).toBe(201);
      expect(response.body.sku).toBe(productData.sku);
      expect(response.body.name).toBe(productData.name);
      expect(response.body.featured).toBe(true);
    });

    it('should update product', async () => {
      const updateData = {
        name: 'Updated Product Name',
        price: 300.00,
        featured: true
      };

      const response = await request(app)
        .put(`/api/admin/products/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Product Name');
      expect(response.body.price).toBe(300.00);
      expect(response.body.featured).toBe(true);
    });

    it('should delete product', async () => {
      const response = await request(app)
        .delete(`/api/admin/products/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 409 for duplicate SKU', async () => {
      const response = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          sku: 'TEST-CAR-001', // Same as beforeEach product
          name: 'Duplicate SKU Product',
          description: 'This should fail',
          category: 'cars',
          price: 20000.00,
          stock_quantity: 1,
          brand: 'TestBrand'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('SKU_ALREADY_EXISTS');
    });
  });
});