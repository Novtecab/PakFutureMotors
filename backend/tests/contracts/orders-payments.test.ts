/**
 * T010: Orders & Payments Contract Tests
 * Tests order creation, payment processing, order management from orders-payments.md
 */
import request from 'supertest';
import app from '../../src/app';

describe('Orders & Payments Contract Tests', () => {
  let accessToken: string;
  let userId: string;
  let productId: string;
  let orderId: string;
  let paymentId: string;

  beforeEach(async () => {
    // Register and login a test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'order@example.com',
        password: 'SecurePass123!',
        first_name: 'Order',
        last_name: 'Test',
        auth_provider: 'email'
      });

    accessToken = userResponse.body.tokens.access_token;
    userId = userResponse.body.user.id;

    // Create a test product and add to cart
    const productResponse = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'ORDER-TEST-001',
        name: 'Order Test Product',
        description: 'Product for order testing',
        category: 'accessories',
        price: 100.00,
        stock_quantity: 10,
        brand: 'TestBrand'
      });

    productId = productResponse.body.id;

    // Add product to cart
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        product_id: productId,
        quantity: 2
      });

    // Add user address
    await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'shipping',
        street_address: '123 Test St',
        city: 'Test City',
        state: 'CA',
        postal_code: '12345',
        country: 'US',
        is_default: true
      });
  });

  describe('POST /api/orders', () => {
    it('should create order from cart', async () => {
      const orderData = {
        shipping_address_id: 'user_address_id',
        billing_address_id: 'user_address_id',
        shipping_method: 'standard',
        payment_method: {
          type: 'credit_card',
          token: 'mock_stripe_token',
          billing_address: {
            street_address: '123 Test St',
            city: 'Test City',
            state: 'CA',
            postal_code: '12345',
            country: 'US'
          }
        },
        notes: 'Test order notes'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('order');
      expect(response.body).toHaveProperty('payment');
      
      const order = response.body.order;
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('order_number');
      expect(order).toHaveProperty('items');
      expect(order).toHaveProperty('subtotal');
      expect(order).toHaveProperty('tax_amount');
      expect(order).toHaveProperty('shipping_amount');
      expect(order).toHaveProperty('total_amount');
      expect(order.status).toBe('pending');
      expect(order.items).toHaveLength(1);
      expect(order.items[0].quantity).toBe(2);
      
      const payment = response.body.payment;
      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('status');
      expect(payment).toHaveProperty('amount');
      expect(payment.payment_method).toBe('credit_card');
      
      orderId = order.id;
      paymentId = payment.id;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          shipping_address_id: 'test_address',
          billing_address_id: 'test_address',
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'mock_token',
            billing_address: {}
          }
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should return 400 for empty cart', async () => {
      // Clear the cart first
      await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: 'test_address',
          billing_address_id: 'test_address',
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'mock_token',
            billing_address: {}
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CART_EMPTY');
    });

    it('should handle insufficient inventory', async () => {
      // Add more items than available stock
      await request(app)
        .put('/api/cart/items/test-item-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantity: 15 // More than the 10 in stock
        });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: 'test_address',
          billing_address_id: 'test_address',
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'mock_token',
            billing_address: {}
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INSUFFICIENT_INVENTORY');
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      // Create a test order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: 'test_address',
          billing_address_id: 'test_address',
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'mock_token',
            billing_address: {
              street_address: '123 Test St',
              city: 'Test City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          }
        });

      orderId = orderResponse.body.order.id;
    });

    it('should list user orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body.orders.length).toBeGreaterThan(0);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          status: 'pending'
        });

      expect(response.status).toBe(200);
      response.body.orders.forEach((order: any) => {
        expect(order.status).toBe('pending');
      });
    });

    it('should filter orders by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateString = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          from_date: today,
          to_date: futureDateString
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.orders)).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          page: 1,
          limit: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/orders/:id', () => {
    beforeEach(async () => {
      // Create a test order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: 'test_address',
          billing_address_id: 'test_address',
          shipping_method: 'express',
          payment_method: {
            type: 'paypal',
            token: 'mock_paypal_token',
            billing_address: {
              street_address: '123 Test St',
              city: 'Test City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          }
        });

      orderId = orderResponse.body.order.id;
    });

    it('should get order details', async () => {
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', orderId);
      expect(response.body).toHaveProperty('order_number');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('payment');
      expect(response.body).toHaveProperty('status_history');
      expect(response.body).toHaveProperty('shipping_address');
      expect(response.body).toHaveProperty('billing_address');
      expect(Array.isArray(response.body.status_history)).toBe(true);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should only allow access to own orders', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'SecurePass123!',
          first_name: 'Other',
          last_name: 'User',
          auth_provider: 'email'
        });

      const otherAccessToken = otherUserResponse.body.tokens.access_token;

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    beforeEach(async () => {
      // Create a test order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: 'test_address',
          billing_address_id: 'test_address',
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'mock_token',
            billing_address: {
              street_address: '123 Test St',
              city: 'Test City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          }
        });

      orderId = orderResponse.body.order.id;
    });

    it('should cancel order successfully', async () => {
      const response = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'Changed mind'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('refund_info');
      expect(response.body.refund_info).toHaveProperty('amount');
      expect(response.body.refund_info).toHaveProperty('processing_time');
      expect(response.body.refund_info).toHaveProperty('refund_method');
    });

    it('should return 400 for already shipped order', async () => {
      // First update order status to shipped (admin operation)
      await request(app)
        .put(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'shipped',
          tracking_number: 'TRACK123456'
        });

      const response = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'Too late'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
    });
  });

  describe('Payment Processing', () => {
    describe('POST /api/payments/process', () => {
      beforeEach(async () => {
        // Create a test order
        const orderResponse = await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            shipping_address_id: 'test_address',
            billing_address_id: 'test_address',
            shipping_method: 'standard',
            payment_method: {
              type: 'credit_card',
              token: 'mock_token',
              billing_address: {
                street_address: '123 Test St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        orderId = orderResponse.body.order.id;
      });

      it('should process payment for order', async () => {
        const paymentData = {
          order_id: orderId,
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {
              street_address: '123 Test St',
              city: 'Test City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          },
          return_url: 'https://example.com/return'
        };

        const response = await request(app)
          .post('/api/payments/process')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(paymentData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('payment');
        expect(response.body.payment).toHaveProperty('id');
        expect(response.body.payment).toHaveProperty('status');
        expect(response.body.payment).toHaveProperty('amount');
        expect(response.body.payment.payment_method).toBe('credit_card');
        
        paymentId = response.body.payment.id;
      });

      it('should handle payment requiring additional action', async () => {
        const paymentData = {
          order_id: orderId,
          payment_method: {
            type: 'credit_card',
            token: 'tok_3ds_required', // Token that requires 3D Secure
            billing_address: {
              street_address: '123 Test St',
              city: 'Test City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          }
        };

        const response = await request(app)
          .post('/api/payments/process')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(paymentData);

        expect(response.status).toBe(200);
        expect(response.body.payment.status).toBe('requires_action');
        expect(response.body).toHaveProperty('next_action');
        expect(response.body.next_action).toHaveProperty('type');
        expect(response.body.next_action).toHaveProperty('url');
      });

      it('should return 404 for non-existent order', async () => {
        const response = await request(app)
          .post('/api/payments/process')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            order_id: 'non-existent-order',
            payment_method: {
              type: 'credit_card',
              token: 'tok_visa',
              billing_address: {}
            }
          });

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('ORDER_NOT_FOUND');
      });

      it('should return 400 for already paid order', async () => {
        // First process payment successfully
        await request(app)
          .post('/api/payments/process')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            order_id: orderId,
            payment_method: {
              type: 'credit_card',
              token: 'tok_visa',
              billing_address: {}
            }
          });

        // Try to pay again
        const response = await request(app)
          .post('/api/payments/process')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            order_id: orderId,
            payment_method: {
              type: 'credit_card',
              token: 'tok_visa',
              billing_address: {}
            }
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('ORDER_ALREADY_PAID');
      });
    });

    describe('GET /api/payments/:id', () => {
      beforeEach(async () => {
        // Create order and process payment
        const orderResponse = await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            shipping_address_id: 'test_address',
            billing_address_id: 'test_address',
            shipping_method: 'standard',
            payment_method: {
              type: 'credit_card',
              token: 'mock_token',
              billing_address: {}
            }
          });

        orderId = orderResponse.body.order.id;
        paymentId = orderResponse.body.payment.id;
      });

      it('should get payment status', async () => {
        const response = await request(app)
          .get(`/api/payments/${paymentId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', paymentId);
        expect(response.body).toHaveProperty('amount');
        expect(response.body).toHaveProperty('currency');
        expect(response.body).toHaveProperty('payment_method');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('created_at');
        expect(response.body).toHaveProperty('order_id', orderId);
      });

      it('should return 404 for non-existent payment', async () => {
        const response = await request(app)
          .get('/api/payments/non-existent-id')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('PAYMENT_NOT_FOUND');
      });
    });

    describe('POST /api/payments/:id/retry', () => {
      beforeEach(async () => {
        // Create order with failed payment
        const orderResponse = await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            shipping_address_id: 'test_address',
            billing_address_id: 'test_address',
            shipping_method: 'standard',
            payment_method: {
              type: 'credit_card',
              token: 'tok_chargeDeclined', // This should fail
              billing_address: {}
            }
          });

        paymentId = orderResponse.body.payment.id;
      });

      it('should retry failed payment', async () => {
        const response = await request(app)
          .post(`/api/payments/${paymentId}/retry`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            payment_method: {
              type: 'credit_card',
              token: 'tok_visa', // Valid token for retry
              billing_address: {}
            }
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('payment');
        expect(response.body.payment).toHaveProperty('status');
      });

      it('should return 400 for already successful payment', async () => {
        // First make the payment successful
        await request(app)
          .post(`/api/payments/${paymentId}/retry`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            payment_method: {
              type: 'credit_card',
              token: 'tok_visa',
              billing_address: {}
            }
          });

        // Try to retry again
        const response = await request(app)
          .post(`/api/payments/${paymentId}/retry`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            payment_method: {
              type: 'credit_card',
              token: 'tok_visa',
              billing_address: {}
            }
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('PAYMENT_ALREADY_SUCCESSFUL');
      });
    });

    describe('POST /api/payments/:id/refund', () => {
      beforeEach(async () => {
        // Create successful order and payment
        const orderResponse = await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            shipping_address_id: 'test_address',
            billing_address_id: 'test_address',
            shipping_method: 'standard',
            payment_method: {
              type: 'credit_card',
              token: 'tok_visa',
              billing_address: {}
            }
          });

        paymentId = orderResponse.body.payment.id;
      });

      it('should process full refund', async () => {
        const response = await request(app)
          .post(`/api/payments/${paymentId}/refund`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            reason: 'Customer requested refund'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('refund');
        expect(response.body.refund).toHaveProperty('id');
        expect(response.body.refund).toHaveProperty('payment_id', paymentId);
        expect(response.body.refund).toHaveProperty('amount');
        expect(response.body.refund).toHaveProperty('status');
        expect(response.body.refund).toHaveProperty('reason');
        expect(response.body.refund).toHaveProperty('expected_date');
      });

      it('should process partial refund', async () => {
        const response = await request(app)
          .post(`/api/payments/${paymentId}/refund`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            amount: 50.00,
            reason: 'Partial refund for damaged item'
          });

        expect(response.status).toBe(200);
        expect(response.body.refund.amount).toBe(50.00);
      });

      it('should return 400 for refund amount exceeding payment', async () => {
        const response = await request(app)
          .post(`/api/payments/${paymentId}/refund`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            amount: 999999.00, // Way more than the payment amount
            reason: 'Invalid refund amount'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_REFUND_AMOUNT');
      });
    });
  });

  describe('Shipping & Tax Calculation', () => {
    describe('POST /api/shipping/calculate', () => {
      it('should calculate shipping costs', async () => {
        const calculationData = {
          items: [
            { product_id: productId, quantity: 2 }
          ],
          shipping_address: {
            street_address: '123 Test St',
            city: 'Test City',
            state: 'CA',
            postal_code: '12345',
            country: 'US'
          },
          shipping_method: 'standard'
        };

        const response = await request(app)
          .post('/api/shipping/calculate')
          .send(calculationData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('shipping_options');
        expect(response.body).toHaveProperty('tax_calculation');
        
        expect(Array.isArray(response.body.shipping_options)).toBe(true);
        if (response.body.shipping_options.length > 0) {
          const option = response.body.shipping_options[0];
          expect(option).toHaveProperty('method');
          expect(option).toHaveProperty('name');
          expect(option).toHaveProperty('cost');
          expect(option).toHaveProperty('estimated_days');
        }
        
        const tax = response.body.tax_calculation;
        expect(tax).toHaveProperty('subtotal');
        expect(tax).toHaveProperty('tax_rate');
        expect(tax).toHaveProperty('tax_amount');
        expect(tax).toHaveProperty('total');
      });

      it('should work for guest users', async () => {
        const response = await request(app)
          .post('/api/shipping/calculate')
          .send({
            items: [{ product_id: productId, quantity: 1 }],
            shipping_address: {
              street_address: '456 Another St',
              city: 'Another City',
              state: 'NY',
              postal_code: '67890',
              country: 'US'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('shipping_options');
        expect(response.body).toHaveProperty('tax_calculation');
      });
    });
  });

  describe('Admin Order Management', () => {
    beforeEach(async () => {
      // Create a test order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: 'test_address',
          billing_address_id: 'test_address',
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {}
          }
        });

      orderId = orderResponse.body.order.id;
    });

    describe('GET /api/admin/orders', () => {
      it('should list all orders for admin', async () => {
        const response = await request(app)
          .get('/api/admin/orders')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('orders');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.orders)).toBe(true);
      });

      it('should filter orders by multiple criteria', async () => {
        const response = await request(app)
          .get('/api/admin/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            status: 'pending',
            min_amount: 50,
            max_amount: 500,
            payment_status: 'completed'
          });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.orders)).toBe(true);
      });
    });

    describe('PUT /api/admin/orders/:id/status', () => {
      it('should update order status', async () => {
        const response = await request(app)
          .put(`/api/admin/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            status: 'shipped',
            tracking_number: 'TRACK123456789',
            notes: 'Order shipped via express delivery',
            notify_customer: true
          });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('shipped');
        expect(response.body.tracking_number).toBe('TRACK123456789');
      });
    });

    describe('GET /api/admin/orders/analytics', () => {
      it('should return order analytics', async () => {
        const response = await request(app)
          .get('/api/admin/orders/analytics')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            period: 'month'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('summary');
        expect(response.body).toHaveProperty('trends');
        
        const summary = response.body.summary;
        expect(summary).toHaveProperty('total_orders');
        expect(summary).toHaveProperty('total_revenue');
        expect(summary).toHaveProperty('average_order_value');
        expect(summary).toHaveProperty('pending_orders');
        
        const trends = response.body.trends;
        expect(trends).toHaveProperty('daily_orders');
        expect(trends).toHaveProperty('top_products');
        expect(trends).toHaveProperty('payment_methods');
      });
    });
  });
});