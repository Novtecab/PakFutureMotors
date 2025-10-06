/**
 * T012: Product browsing and cart management flow integration test
 * Browse products, add to cart, modify quantities, cart persistence
 */
import request from 'supertest';
import app from '../../src/app';

describe('Shopping Flow Integration Tests', () => {
  let accessToken: string;
  let userId: string;
  let guestCartId: string;
  let productId1: string;
  let productId2: string;

  beforeEach(async () => {
    // Register user for authenticated tests
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'shopper@example.com',
        password: 'SecurePass123!',
        first_name: 'Shopper',
        last_name: 'Test',
        auth_provider: 'email'
      });

    accessToken = userResponse.body.tokens.access_token;
    userId = userResponse.body.user.id;

    // Create test products
    const product1Response = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'SHOP-CAR-001',
        name: 'Tesla Model S',
        description: 'Premium electric sedan',
        category: 'cars',
        price: 79999.00,
        stock_quantity: 3,
        brand: 'Tesla',
        model: 'Model S',
        year: 2024,
        featured: true,
        tags: ['electric', 'luxury', 'sedan'],
        search_keywords: ['tesla', 'electric', 'luxury', 'car']
      });

    const product2Response = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'SHOP-ACC-001',
        name: 'Premium Car Cover',
        description: 'Weather-resistant car cover',
        category: 'accessories',
        price: 149.99,
        stock_quantity: 20,
        brand: 'CarShield',
        featured: false,
        tags: ['protection', 'cover', 'weather'],
        search_keywords: ['cover', 'protection', 'weather', 'shield']
      });

    productId1 = product1Response.body.id;
    productId2 = product2Response.body.id;
  });

  describe('Product Discovery Flow', () => {
    it('should complete product browsing journey', async () => {
      // Step 1: Browse all products
      const browseAll = await request(app)
        .get('/api/products')
        .query({
          page: 1,
          limit: 10,
          sort: 'price_desc'
        });

      expect(browseAll.status).toBe(200);
      expect(browseAll.body.products).toHaveLength(2);
      expect(browseAll.body.pagination.total).toBe(2);
      expect(browseAll.body.products[0].price).toBeGreaterThan(browseAll.body.products[1].price);

      // Step 2: Filter by category
      const filterCars = await request(app)
        .get('/api/products')
        .query({
          category: 'cars'
        });

      expect(filterCars.status).toBe(200);
      expect(filterCars.body.products).toHaveLength(1);
      expect(filterCars.body.products[0].category).toBe('cars');

      // Step 3: Search products
      const searchResults = await request(app)
        .get('/api/products')
        .query({
          search: 'Tesla electric'
        });

      expect(searchResults.status).toBe(200);
      expect(searchResults.body.products).toHaveLength(1);
      expect(searchResults.body.products[0].name).toContain('Tesla');

      // Step 4: Filter by price range
      const priceFilter = await request(app)
        .get('/api/products')
        .query({
          min_price: 100,
          max_price: 200
        });

      expect(priceFilter.status).toBe(200);
      expect(priceFilter.body.products).toHaveLength(1);
      expect(priceFilter.body.products[0].price).toBeLessThan(200);

      // Step 5: Filter by brand
      const brandFilter = await request(app)
        .get('/api/products')
        .query({
          brand: 'Tesla'
        });

      expect(brandFilter.status).toBe(200);
      expect(brandFilter.body.products).toHaveLength(1);
      expect(brandFilter.body.products[0].brand).toBe('Tesla');

      // Step 6: Show only featured products
      const featuredFilter = await request(app)
        .get('/api/products')
        .query({
          featured: true
        });

      expect(featuredFilter.status).toBe(200);
      expect(featuredFilter.body.products).toHaveLength(1);
      expect(featuredFilter.body.products[0].featured).toBe(true);

      // Step 7: Get search suggestions
      const suggestions = await request(app)
        .get('/api/products/search/suggestions')
        .query({
          q: 'car',
          limit: 5
        });

      expect(suggestions.status).toBe(200);
      expect(suggestions.body.suggestions.products.length).toBeGreaterThan(0);
      expect(suggestions.body.suggestions.categories).toContain('cars');
      expect(suggestions.body.suggestions.brands).toContain('Tesla');

      // Step 8: Get product details
      const productDetails = await request(app)
        .get(`/api/products/${productId1}`);

      expect(productDetails.status).toBe(200);
      expect(productDetails.body.id).toBe(productId1);
      expect(productDetails.body).toHaveProperty('specifications');
      expect(productDetails.body).toHaveProperty('related_products');
      expect(productDetails.body).toHaveProperty('images');
      expect(productDetails.body).toHaveProperty('documents');
    });
  });

  describe('Guest Cart Flow', () => {
    it('should complete guest shopping cart journey', async () => {
      // Step 1: Get empty cart as guest
      const emptyCart = await request(app)
        .get('/api/cart');

      expect(emptyCart.status).toBe(200);
      expect(emptyCart.body.items).toHaveLength(0);
      expect(emptyCart.body.subtotal).toBe(0);
      expect(emptyCart.body.item_count).toBe(0);
      guestCartId = emptyCart.body.id;

      // Step 2: Add first product to guest cart
      const addProduct1 = await request(app)
        .post('/api/cart/items')
        .send({
          product_id: productId1,
          quantity: 1
        });

      expect(addProduct1.status).toBe(200);
      expect(addProduct1.body.items).toHaveLength(1);
      expect(addProduct1.body.items[0].product.id).toBe(productId1);
      expect(addProduct1.body.items[0].quantity).toBe(1);
      expect(addProduct1.body.subtotal).toBe(79999.00);
      expect(addProduct1.body.item_count).toBe(1);

      const itemId1 = addProduct1.body.items[0].id;

      // Step 3: Add second product to guest cart
      const addProduct2 = await request(app)
        .post('/api/cart/items')
        .send({
          product_id: productId2,
          quantity: 2
        });

      expect(addProduct2.status).toBe(200);
      expect(addProduct2.body.items).toHaveLength(2);
      expect(addProduct2.body.subtotal).toBe(80298.98); // 79999 + (149.99 * 2)
      expect(addProduct2.body.item_count).toBe(3);

      const itemId2 = addProduct2.body.items.find((item: any) => item.product.id === productId2).id;

      // Step 4: Update item quantity
      const updateQuantity = await request(app)
        .put(`/api/cart/items/${itemId1}`)
        .send({
          quantity: 2
        });

      expect(updateQuantity.status).toBe(200);
      expect(updateQuantity.body.item_count).toBe(4); // 2 + 2
      expect(updateQuantity.body.subtotal).toBe(160298.98); // (79999 * 2) + (149.99 * 2)

      // Step 5: Remove an item
      const removeItem = await request(app)
        .delete(`/api/cart/items/${itemId2}`);

      expect(removeItem.status).toBe(200);
      expect(removeItem.body.items).toHaveLength(1);
      expect(removeItem.body.subtotal).toBe(159998.00); // 79999 * 2
      expect(removeItem.body.item_count).toBe(2);

      // Step 6: Clear entire cart
      const clearCart = await request(app)
        .delete('/api/cart');

      expect(clearCart.status).toBe(200);
      expect(clearCart.body.success).toBe(true);

      // Step 7: Verify cart is empty
      const verifyEmpty = await request(app)
        .get('/api/cart');

      expect(verifyEmpty.status).toBe(200);
      expect(verifyEmpty.body.items).toHaveLength(0);
      expect(verifyEmpty.body.subtotal).toBe(0);
    });
  });

  describe('Authenticated User Cart Flow', () => {
    it('should complete authenticated user cart journey', async () => {
      // Step 1: Get empty authenticated cart
      const emptyCart = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(emptyCart.status).toBe(200);
      expect(emptyCart.body.items).toHaveLength(0);

      // Step 2: Add products to authenticated cart
      const addToCart = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 1
        });

      expect(addToCart.status).toBe(200);
      expect(addToCart.body.items).toHaveLength(1);

      // Step 3: Logout and verify cart persistence
      await request(app)
        .post('/api/auth/logout')
        .send({ refresh_token: 'test_refresh_token' });

      // Step 4: Login again
      const loginAgain = await request(app)
        .post('/api/auth/login')
        .send({
          credential: 'shopper@example.com',
          password: 'SecurePass123!',
          auth_provider: 'email'
        });

      const newAccessToken = loginAgain.body.tokens.access_token;

      // Step 5: Verify cart was persisted
      const persistedCart = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(persistedCart.status).toBe(200);
      expect(persistedCart.body.items).toHaveLength(1);
      expect(persistedCart.body.items[0].product.id).toBe(productId1);
    });
  });

  describe('Guest to User Cart Merge Flow', () => {
    it('should complete cart merge journey', async () => {
      // Step 1: Create guest cart with items
      const guestAddItem1 = await request(app)
        .post('/api/cart/items')
        .send({
          product_id: productId1,
          quantity: 1
        });

      const guestCartId = guestAddItem1.body.id;

      const guestAddItem2 = await request(app)
        .post('/api/cart/items')
        .send({
          product_id: productId2,
          quantity: 3
        });

      expect(guestAddItem2.body.items).toHaveLength(2);
      expect(guestAddItem2.body.item_count).toBe(4);

      // Step 2: Add different item to user cart
      const userAddItem = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId2,
          quantity: 1
        });

      expect(userAddItem.body.items).toHaveLength(1);
      expect(userAddItem.body.item_count).toBe(1);

      // Step 3: Merge guest cart with user cart
      const mergeCart = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          guest_cart_id: guestCartId
        });

      expect(mergeCart.status).toBe(200);
      expect(mergeCart.body.items).toHaveLength(2);
      
      // Verify quantities are combined correctly
      const teslaItem = mergeCart.body.items.find((item: any) => item.product.id === productId1);
      const coverItem = mergeCart.body.items.find((item: any) => item.product.id === productId2);
      
      expect(teslaItem.quantity).toBe(1); // From guest cart
      expect(coverItem.quantity).toBe(4); // 1 from user + 3 from guest
      expect(mergeCart.body.item_count).toBe(5);

      // Step 4: Verify guest cart is cleared after merge
      const guestCartAfterMerge = await request(app)
        .get('/api/cart');

      expect(guestCartAfterMerge.body.items).toHaveLength(0);
    });
  });

  describe('Inventory Management Flow', () => {
    it('should handle stock limitations correctly', async () => {
      // Step 1: Attempt to add more than available stock
      const exceedStock = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1, // Tesla has 3 in stock
          quantity: 5
        });

      expect(exceedStock.status).toBe(400);
      expect(exceedStock.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Step 2: Add maximum available quantity
      const maxQuantity = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 3
        });

      expect(maxQuantity.status).toBe(200);
      expect(maxQuantity.body.items[0].quantity).toBe(3);

      // Step 3: Try to add more of the same product
      const addMore = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 1
        });

      expect(addMore.status).toBe(400);
      expect(addMore.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Step 4: Reduce quantity and verify it works
      const itemId = maxQuantity.body.items[0].id;
      const reduceQuantity = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantity: 2
        });

      expect(reduceQuantity.status).toBe(200);
      expect(reduceQuantity.body.items[0].quantity).toBe(2);

      // Step 5: Now add one more (should work)
      const addOneMore = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 1
        });

      expect(addOneMore.status).toBe(200);
      expect(addOneMore.body.items[0].quantity).toBe(3);
    });
  });

  describe('Error Handling in Shopping Flow', () => {
    it('should handle invalid operations gracefully', async () => {
      // Test invalid product ID
      const invalidProduct = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: 'invalid-product-id',
          quantity: 1
        });

      expect(invalidProduct.status).toBe(400);
      expect(invalidProduct.body.error.code).toBe('PRODUCT_NOT_FOUND');

      // Test invalid quantity
      const invalidQuantity = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 0
        });

      expect(invalidQuantity.status).toBe(400);
      expect(invalidQuantity.body.error.code).toBe('INVALID_QUANTITY');

      // Test updating non-existent cart item
      const invalidItemUpdate = await request(app)
        .put('/api/cart/items/non-existent-item')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantity: 2
        });

      expect(invalidItemUpdate.status).toBe(404);
      expect(invalidItemUpdate.body.error.code).toBe('CART_ITEM_NOT_FOUND');

      // Test deleting non-existent cart item
      const invalidItemDelete = await request(app)
        .delete('/api/cart/items/non-existent-item')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(invalidItemDelete.status).toBe(404);
      expect(invalidItemDelete.body.error.code).toBe('CART_ITEM_NOT_FOUND');
    });
  });

  describe('Cart Expiration Flow', () => {
    it('should handle cart expiration correctly', async () => {
      // Add item to guest cart
      const addToGuestCart = await request(app)
        .post('/api/cart/items')
        .send({
          product_id: productId1,
          quantity: 1
        });

      expect(addToGuestCart.status).toBe(200);
      expect(addToGuestCart.body).toHaveProperty('expires_at');

      // Verify cart expires_at is in the future
      const expiresAt = new Date(addToGuestCart.body.expires_at);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());

      // Test accessing expired cart (this would be tested with time manipulation in real scenarios)
      // For now, we just verify the field exists and is properly formatted
      expect(addToGuestCart.body.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });
});