/**
 * T014: Order processing complete flow integration test
 * Cart to order conversion, payment processing, order status updates
 */
import request from 'supertest';
import app from '../../src/app';

describe('Order Processing Flow Integration Tests', () => {
  let accessToken: string;
  let userId: string;
  let productId1: string;
  let productId2: string;
  let addressId: string;
  let orderId: string;
  let paymentId: string;

  beforeEach(async () => {
    // Register user
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

    // Create test products
    const product1Response = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'ORDER-CAR-001',
        name: 'BMW M3',
        description: 'High-performance sports sedan',
        category: 'cars',
        price: 75000.00,
        stock_quantity: 2,
        brand: 'BMW',
        model: 'M3',
        year: 2024
      });

    const product2Response = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'ORDER-ACC-001',
        name: 'Carbon Fiber Spoiler',
        description: 'Lightweight carbon fiber rear spoiler',
        category: 'accessories',
        price: 1200.00,
        stock_quantity: 10,
        brand: 'AeroTech'
      });

    productId1 = product1Response.body.id;
    productId2 = product2Response.body.id;

    // Add user addresses
    const addressResponse = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'shipping',
        street_address: '123 Order St',
        city: 'Order City',
        state: 'CA',
        postal_code: '90210',
        country: 'US',
        is_default: true
      });

    addressId = addressResponse.body.id;
  });

  describe('Complete Order Flow', () => {
    it('should complete full order processing journey', async () => {
      // Step 1: Add products to cart
      const addProduct1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 1
        });

      expect(addProduct1.status).toBe(200);

      const addProduct2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId2,
          quantity: 2
        });

      expect(addProduct2.status).toBe(200);
      expect(addProduct2.body.items).toHaveLength(2);
      expect(addProduct2.body.subtotal).toBe(77400.00); // 75000 + (1200 * 2)

      // Step 2: Calculate shipping and tax
      const shippingCalc = await request(app)
        .post('/api/shipping/calculate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          items: [
            { product_id: productId1, quantity: 1 },
            { product_id: productId2, quantity: 2 }
          ],
          shipping_address: {
            street_address: '123 Order St',
            city: 'Order City',
            state: 'CA',
            postal_code: '90210',
            country: 'US'
          },
          shipping_method: 'standard'
        });

      expect(shippingCalc.status).toBe(200);
      expect(shippingCalc.body).toHaveProperty('shipping_options');
      expect(shippingCalc.body).toHaveProperty('tax_calculation');
      expect(shippingCalc.body.shipping_options.length).toBeGreaterThan(0);

      const shippingCost = shippingCalc.body.shipping_options[0].cost;
      const taxAmount = shippingCalc.body.tax_calculation.tax_amount;

      // Step 3: Create order from cart
      const createOrder = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {
              street_address: '123 Order St',
              city: 'Order City',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            }
          },
          notes: 'Please handle with care - expensive items'
        });

      expect(createOrder.status).toBe(201);
      expect(createOrder.body).toHaveProperty('order');
      expect(createOrder.body).toHaveProperty('payment');

      const order = createOrder.body.order;
      expect(order).toHaveProperty('order_number');
      expect(order.items).toHaveLength(2);
      expect(order.subtotal).toBe(77400.00);
      expect(order.total_amount).toBeGreaterThan(order.subtotal); // Including tax and shipping
      expect(order.status).toBe('pending');

      const payment = createOrder.body.payment;
      expect(payment.status).toBe('processing');
      expect(payment.payment_method).toBe('credit_card');

      orderId = order.id;
      paymentId = payment.id;

      // Step 4: Verify cart is empty after order creation
      const emptyCart = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(emptyCart.status).toBe(200);
      expect(emptyCart.body.items).toHaveLength(0);
      expect(emptyCart.body.subtotal).toBe(0);

      // Step 5: Verify inventory was reserved
      const checkProduct1 = await request(app)
        .get(`/api/products/${productId1}`);

      expect(checkProduct1.status).toBe(200);
      expect(checkProduct1.body.stock_quantity).toBe(1); // Was 2, now 1

      const checkProduct2 = await request(app)
        .get(`/api/products/${productId2}`);

      expect(checkProduct2.status).toBe(200);
      expect(checkProduct2.body.stock_quantity).toBe(8); // Was 10, now 8

      // Step 6: Get order details
      const orderDetails = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(orderDetails.status).toBe(200);
      expect(orderDetails.body.id).toBe(orderId);
      expect(orderDetails.body).toHaveProperty('status_history');
      expect(orderDetails.body).toHaveProperty('payment');
      expect(orderDetails.body.payment.id).toBe(paymentId);

      // Step 7: Process payment
      const processPayment = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          order_id: orderId,
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {
              street_address: '123 Order St',
              city: 'Order City',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            }
          }
        });

      expect(processPayment.status).toBe(200);
      expect(processPayment.body.payment.status).toBe('completed');

      // Step 8: Verify order status updated
      const updatedOrder = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(updatedOrder.status).toBe(200);
      expect(updatedOrder.body.status).toBe('confirmed'); // Should be confirmed after payment
    });
  });

  describe('Order Management Flow', () => {
    beforeEach(async () => {
      // Create order for management tests
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 1
        });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'express',
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {
              street_address: '123 Order St',
              city: 'Order City',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            }
          }
        });

      orderId = orderResponse.body.order.id;
      paymentId = orderResponse.body.payment.id;
    });

    it('should complete order management journey', async () => {
      // Step 1: List user orders
      const userOrders = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(userOrders.status).toBe(200);
      expect(userOrders.body.orders).toHaveLength(1);
      expect(userOrders.body.orders[0].id).toBe(orderId);

      // Step 2: Filter orders by status
      const pendingOrders = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          status: 'pending'
        });

      expect(pendingOrders.status).toBe(200);
      pendingOrders.body.orders.forEach((order: any) => {
        expect(order.status).toBe('pending');
      });

      // Step 3: Admin updates order status to confirmed
      const confirmOrder = await request(app)
        .put(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'confirmed',
          notes: 'Order confirmed after payment verification',
          notify_customer: true
        });

      expect(confirmOrder.status).toBe(200);
      expect(confirmOrder.body.status).toBe('confirmed');

      // Step 4: Admin updates order to processing
      const processOrder = await request(app)
        .put(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'processing',
          notes: 'Order is being prepared for shipment'
        });

      expect(processOrder.status).toBe(200);
      expect(processOrder.body.status).toBe('processing');

      // Step 5: Admin ships order
      const shipOrder = await request(app)
        .put(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'shipped',
          tracking_number: 'TRACK123456789',
          notes: 'Order shipped via express delivery',
          notify_customer: true
        });

      expect(shipOrder.status).toBe(200);
      expect(shipOrder.body.status).toBe('shipped');
      expect(shipOrder.body.tracking_number).toBe('TRACK123456789');
      expect(shipOrder.body.shipped_at).toBeTruthy();

      // Step 6: Verify order status history
      const finalOrder = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(finalOrder.status).toBe(200);
      expect(finalOrder.body.status_history).toHaveLength(4); // pending -> confirmed -> processing -> shipped
      expect(finalOrder.body.tracking_number).toBe('TRACK123456789');

      // Step 7: Admin marks as delivered
      const deliverOrder = await request(app)
        .put(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'delivered',
          notes: 'Order delivered successfully'
        });

      expect(deliverOrder.status).toBe(200);
      expect(deliverOrder.body.status).toBe('delivered');
      expect(deliverOrder.body.delivered_at).toBeTruthy();
    });
  });

  describe('Payment Processing Flow', () => {
    beforeEach(async () => {
      // Create order for payment tests
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId2,
          quantity: 1
        });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'tok_chargeDeclined', // This will fail initially
            billing_address: {
              street_address: '123 Order St',
              city: 'Order City',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            }
          }
        });

      orderId = orderResponse.body.order.id;
      paymentId = orderResponse.body.payment.id;
    });

    it('should complete payment processing journey', async () => {
      // Step 1: Verify payment failed
      const failedPayment = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(failedPayment.status).toBe(200);
      expect(failedPayment.body.status).toBe('failed');
      expect(failedPayment.body).toHaveProperty('failure_reason');

      // Step 2: Retry payment with valid token
      const retryPayment = await request(app)
        .post(`/api/payments/${paymentId}/retry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa', // Valid token
            billing_address: {
              street_address: '123 Order St',
              city: 'Order City',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            }
          }
        });

      expect(retryPayment.status).toBe(200);
      expect(retryPayment.body.payment.status).toBe('completed');

      // Step 3: Verify payment status updated
      const successfulPayment = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(successfulPayment.status).toBe(200);
      expect(successfulPayment.body.status).toBe('completed');
      expect(successfulPayment.body.processed_at).toBeTruthy();

      // Step 4: Try different payment methods
      // Create another order for PayPal test
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId2,
          quantity: 1
        });

      const paypalOrder = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'standard',
          payment_method: {
            type: 'paypal',
            token: 'paypal_token_123',
            billing_address: {
              street_address: '123 Order St',
              city: 'Order City',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            }
          }
        });

      expect(paypalOrder.status).toBe(201);
      expect(paypalOrder.body.payment.payment_method).toBe('paypal');

      // Step 5: Test bank transfer
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId2,
          quantity: 1
        });

      const bankTransferOrder = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'standard',
          payment_method: {
            type: 'bank_transfer',
            billing_address: {
              street_address: '123 Order St',
              city: 'Order City',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            }
          }
        });

      expect(bankTransferOrder.status).toBe(201);
      expect(bankTransferOrder.body.payment.payment_method).toBe('bank_transfer');
    });
  });

  describe('Order Cancellation and Refund Flow', () => {
    beforeEach(async () => {
      // Create and complete order for cancellation tests
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 1
        });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {
              street_address: '123 Order St',
              city: 'Order City',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            }
          }
        });

      orderId = orderResponse.body.order.id;
      paymentId = orderResponse.body.payment.id;

      // Process payment
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
    });

    it('should complete cancellation and refund journey', async () => {
      // Step 1: Cancel order before shipping
      const cancelOrder = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'Customer changed mind'
        });

      expect(cancelOrder.status).toBe(200);
      expect(cancelOrder.body.success).toBe(true);
      expect(cancelOrder.body).toHaveProperty('refund_info');
      expect(cancelOrder.body.refund_info.amount).toBe(75000.00);

      // Step 2: Verify order status updated
      const cancelledOrder = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(cancelledOrder.status).toBe(200);
      expect(cancelledOrder.body.status).toBe('cancelled');

      // Step 3: Process refund
      const processRefund = await request(app)
        .post(`/api/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'Order cancelled by customer'
        });

      expect(processRefund.status).toBe(200);
      expect(processRefund.body.refund).toHaveProperty('id');
      expect(processRefund.body.refund.status).toBe('pending');
      expect(processRefund.body.refund.amount).toBe(75000.00);

      // Step 4: Verify inventory was restored
      const restoredProduct = await request(app)
        .get(`/api/products/${productId1}`);

      expect(restoredProduct.status).toBe(200);
      expect(restoredProduct.body.stock_quantity).toBe(2); // Back to original quantity
    });
  });

  describe('Admin Analytics Flow', () => {
    beforeEach(async () => {
      // Create multiple orders for analytics
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/cart/items')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            product_id: productId2,
            quantity: 1
          });

        await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            shipping_address_id: addressId,
            billing_address_id: addressId,
            shipping_method: 'standard',
            payment_method: {
              type: 'credit_card',
              token: 'tok_visa',
              billing_address: {}
            }
          });
      }
    });

    it('should complete analytics journey', async () => {
      // Step 1: Get admin order list
      const adminOrders = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(adminOrders.status).toBe(200);
      expect(adminOrders.body.orders.length).toBeGreaterThanOrEqual(3);

      // Step 2: Filter admin orders
      const filteredOrders = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          status: 'pending',
          min_amount: 1000,
          max_amount: 2000
        });

      expect(filteredOrders.status).toBe(200);
      filteredOrders.body.orders.forEach((order: any) => {
        expect(order.status).toBe('pending');
        expect(order.total_amount).toBeGreaterThanOrEqual(1000);
        expect(order.total_amount).toBeLessThanOrEqual(2000);
      });

      // Step 3: Get analytics dashboard
      const analytics = await request(app)
        .get('/api/admin/orders/analytics')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          period: 'month'
        });

      expect(analytics.status).toBe(200);
      expect(analytics.body).toHaveProperty('summary');
      expect(analytics.body).toHaveProperty('trends');

      const summary = analytics.body.summary;
      expect(summary).toHaveProperty('total_orders');
      expect(summary).toHaveProperty('total_revenue');
      expect(summary).toHaveProperty('average_order_value');
      expect(summary).toHaveProperty('pending_orders');

      const trends = analytics.body.trends;
      expect(trends).toHaveProperty('daily_orders');
      expect(trends).toHaveProperty('top_products');
      expect(trends).toHaveProperty('payment_methods');
      expect(Array.isArray(trends.daily_orders)).toBe(true);
      expect(Array.isArray(trends.top_products)).toBe(true);
    });
  });

  describe('Error Handling in Order Flow', () => {
    it('should handle order processing errors gracefully', async () => {
      // Test creating order with empty cart
      const emptyCartOrder = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {}
          }
        });

      expect(emptyCartOrder.status).toBe(400);
      expect(emptyCartOrder.body.error.code).toBe('CART_EMPTY');

      // Test order with insufficient inventory
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId1,
          quantity: 5 // More than the 2 in stock
        });

      const insufficientStock = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {}
          }
        });

      expect(insufficientStock.status).toBe(400);
      expect(insufficientStock.body.error.code).toBe('INSUFFICIENT_INVENTORY');

      // Test cancelling shipped order
      await request(app)
        .delete('/api/cart'); // Clear cart first

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: productId2,
          quantity: 1
        });

      const shippedOrderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shipping_address_id: addressId,
          billing_address_id: addressId,
          shipping_method: 'standard',
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {}
          }
        });

      const shippedOrderId = shippedOrderResponse.body.order.id;

      // Mark as shipped
      await request(app)
        .put(`/api/admin/orders/${shippedOrderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'shipped',
          tracking_number: 'TEST123'
        });

      // Try to cancel shipped order
      const cancelShipped = await request(app)
        .post(`/api/orders/${shippedOrderId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'Too late to cancel'
        });

      expect(cancelShipped.status).toBe(400);
      expect(cancelShipped.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
    });
  });
});