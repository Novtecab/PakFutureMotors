// backend/src/services/OrderService.ts
import { Order, OrderStatus, Product, Address } from '@prisma/client';
import { OrderModel, CreateOrderData, UpdateOrderStatusData, OrderFilters, OrderWithDetails, OrderSummary, OrderAnalytics } from '../models/Order';
import { CartModel } from '../models/Cart';
import { ProductModel } from '../models/Product';
import { AddressModel } from '../models/User';
import { Prisma } from '@prisma/client'; // Import Prisma for Decimal type

export class OrderService {
  /**
   * Creates a new order from a user's shopping cart.
   * @param userId - The ID of the user.
   * @param cartId - The ID of the cart to convert to an order.
   * @param data - Additional order data (shipping/billing addresses, method, notes).
   * @returns The created order with its details and order number.
   */
  static async createOrderFromCart(
    userId: string,
    cartId: string,
    data: CreateOrderData
  ): Promise<{ order: OrderWithDetails; orderNumber: string }> {
    const validatedData = CreateOrderData.parse(data); // Assuming CreateOrderData is a Zod schema

    return await Prisma.getExtension(prisma).$transaction(async (tx) => {
      // Validate cart
      const cartValidation = await CartModel.validateForCheckout(cartId);
      if (!cartValidation.valid) {
        throw new Error(cartValidation.errors[0]);
      }

      // Get cart with items
      const cart = await tx.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new Error('CART_EMPTY');
      }

      // Verify and reserve inventory
      for (const item of cart.items) {
        const hasStock = await ProductModel.checkStock(
          item.productId,
          item.quantity
        );
        if (!hasStock) {
          throw new Error(`INSUFFICIENT_INVENTORY_${item.product.name}`);
        }

        // Reserve inventory
        await ProductModel.updateInventory(
          item.productId,
          item.quantity,
          'decrement'
        );
      }

      // Get shipping and billing addresses
      const [shippingAddress, billingAddress] = await Promise.all([
        tx.address.findUnique({ where: { id: validatedData.shippingAddressId } }),
        tx.address.findUnique({ where: { id: validatedData.billingAddressId } }),
      ]);

      if (!shippingAddress || !billingAddress) {
        throw new Error('INVALID_ADDRESS');
      }

      // Calculate order totals
      const orderSummary = this.calculateOrderTotals(
        cart.items,
        validatedData.shippingMethod,
        shippingAddress
      );

      // Generate order number
      const orderNumber = await OrderModel.generateOrderNumber();

      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          subtotal: new Prisma.Decimal(orderSummary.subtotal),
          taxAmount: new Prisma.Decimal(orderSummary.taxAmount),
          shippingAmount: new Prisma.Decimal(orderSummary.shippingAmount),
          discountAmount: new Prisma.Decimal(orderSummary.discountAmount),
          totalAmount: new Prisma.Decimal(orderSummary.totalAmount),
          shippingAddress: {
            streetAddress: shippingAddress.streetAddress,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country,
          } as Prisma.InputJsonValue,
          billingAddress: {
            streetAddress: billingAddress.streetAddress,
            city: billingAddress.city,
            state: billingAddress.state,
            postalCode: billingAddress.postalCode,
            country: billingAddress.country,
          } as Prisma.InputJsonValue,
          shippingMethod: validatedData.shippingMethod,
          notes: validatedData.notes || null,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Create order items
      for (const item of cart.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.price,
            totalPrice: new Prisma.Decimal(Number(item.product.price) * item.quantity),
            productName: item.product.name,
            productSku: item.product.sku,
          },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { cartId },
      });
      await tx.cart.update({
        where: { id: cartId },
        data: { subtotal: new Prisma.Decimal(0) },
      });

      // Get complete order with items
      const completeOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          payment: true, // Include payment if it exists
          user: { // Include user details
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return {
        order: completeOrder as OrderWithDetails,
        orderNumber,
      };
    });
  }

  /**
   * Retrieves an order by its ID.
   * @param orderId - The ID of the order.
   * @returns The order with its details or null if not found.
   */
  static async getOrderById(orderId: string): Promise<OrderWithDetails | null> {
    return OrderModel.findById(orderId);
  }

  /**
   * Retrieves an order by its order number.
   * @param orderNumber - The order number.
   * @returns The order with its details or null if not found.
   */
  static async getOrderByOrderNumber(orderNumber: string): Promise<OrderWithDetails | null> {
    return OrderModel.findByOrderNumber(orderNumber);
  }

  /**
   * Retrieves all orders for a specific user with optional filters and pagination.
   * @param userId - The ID of the user.
   * @param filters - Filters to apply.
   * @param page - Current page number.
   * @param limit - Number of items per page.
   * @returns Paginated list of user orders.
   */
  static async getUserOrders(
    userId: string,
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    orders: OrderWithDetails[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return OrderModel.findByUser(userId, filters, page, limit);
  }

  /**
   * Updates the status of an order.
   * @param orderId - The ID of the order to update.
   * @param data - The update data (status, tracking number, notes, notify customer).
   * @returns The updated order with its details.
   */
  static async updateOrderStatus(orderId: string, data: UpdateOrderStatusData): Promise<OrderWithDetails> {
    return OrderModel.updateStatus(orderId, data);
  }

  /**
   * Cancels an order.
   * @param orderId - The ID of the order to cancel.
   * @param reason - The reason for cancellation.
   * @param userId - Optional: The ID of the user initiating the cancellation (for authorization).
   * @returns An object indicating success and refund information.
   */
  static async cancelOrder(
    orderId: string,
    reason: string,
    userId?: string
  ): Promise<{ success: boolean; refundInfo?: any }> {
    return OrderModel.cancel(orderId, reason, userId);
  }

  /**
   * Retrieves all orders with optional filters and pagination (for admin).
   * @param filters - Filters to apply.
   * @param page - Current page number.
   * @param limit - Number of items per page.
   * @returns Paginated list of all orders.
   */
  static async getAllOrders(
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    orders: OrderWithDetails[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return OrderModel.findAllWithFilters(filters, page, limit);
  }

  /**
   * Retrieves order analytics for a specified period.
   * @param period - The period for analytics ('week', 'month', 'year').
   * @returns Order analytics data.
   */
  static async getOrderAnalytics(period: 'week' | 'month' | 'year' = 'month'): Promise<OrderAnalytics> {
    return OrderModel.getAnalytics(period);
  }

  // Helper methods (moved from OrderModel to keep it focused on Prisma operations)
  private static calculateOrderTotals(
    items: Array<CartItem & { product: Product }>,
    shippingMethod: string,
    shippingAddress: Address
  ): OrderSummary {
    const subtotal = items.reduce(
      (sum, item) => sum + (Number(item.product.price) * item.quantity),
      0
    );

    // Calculate tax based on shipping address (mock calculation)
    const taxRate = this.getTaxRate(shippingAddress.state);
    const taxAmount = subtotal * taxRate;

    // Calculate shipping based on method and items
    const shippingAmount = this.calculateShipping(items, shippingMethod);

    const discountAmount = 0; // No discounts in basic implementation

    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

    return {
      subtotal,
      taxAmount,
      shippingAmount,
      discountAmount,
      totalAmount,
    };
  }

  private static getTaxRate(state: string): number {
    // Mock tax rates by state
    const taxRates: Record<string, number> = {
      'CA': 0.08,
      'NY': 0.07,
      'TX': 0.06,
      'FL': 0.05,
    };
    return taxRates[state] || 0.05;
  }

  private static calculateShipping(items: Array<CartItem & { product: Product }>, method: string): number {
    const baseRates = {
      standard: 10,
      express: 25,
      overnight: 50,
    };

    // Free shipping for orders over $1000 or cars
    const hasExpensiveItems = items.some(item =>
      Number(item.product.price) > 1000 || item.product.category === 'CARS'
    );

    if (hasExpensiveItems) {
      return 0;
    }

    return baseRates[method as keyof typeof baseRates] || 10;
  }
}