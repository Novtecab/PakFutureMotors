/**
 * T022: Order model and processing
 * Order entity with items, status tracking, fulfillment
 */
import { PrismaClient, Order, OrderItem, OrderStatus, Product } from '@prisma/client';
import { z } from 'zod';
import ProductModel from './Product';
import CartModel from './Cart';

const prisma = new PrismaClient();

// Validation schemas
export const CreateOrderSchema = z.object({
  shippingAddressId: z.string().cuid(),
  billingAddressId: z.string().cuid(),
  shippingMethod: z.enum(['standard', 'express', 'overnight']),
  notes: z.string().optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  notifyCustomer: z.boolean().default(true),
});

export const OrderFilterSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
});

export type CreateOrderData = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusData = z.infer<typeof UpdateOrderStatusSchema>;
export type OrderFilters = z.infer<typeof OrderFilterSchema>;

// Order with full details
export type OrderWithDetails = Order & {
  items: (OrderItem & {
    product: Product;
  })[];
  payment?: any;
  user?: any;
};

export interface OrderSummary {
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface OrderAnalytics {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    pendingOrders: number;
  };
  trends: {
    dailyOrders: Array<{ date: string; count: number; revenue: number }>;
    topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
    paymentMethods: Array<{ method: string; count: number; percentage: number }>;
  };
}

export class OrderModel {
  /**
   * Create order from cart
   */
  static async createFromCart(
    userId: string,
    cartId: string,
    data: CreateOrderData
  ): Promise<{ order: OrderWithDetails; orderNumber: string }> {
    const validatedData = CreateOrderSchema.parse(data);

    return await prisma.$transaction(async (tx) => {
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
      const orderNumber = await this.generateOrderNumber();

      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          subtotal: orderSummary.subtotal,
          taxAmount: orderSummary.taxAmount,
          shippingAmount: orderSummary.shippingAmount,
          discountAmount: orderSummary.discountAmount,
          totalAmount: orderSummary.totalAmount,
          shippingAddress: {
            streetAddress: shippingAddress.streetAddress,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country,
          },
          billingAddress: {
            streetAddress: billingAddress.streetAddress,
            city: billingAddress.city,
            state: billingAddress.state,
            postalCode: billingAddress.postalCode,
            country: billingAddress.country,
          },
          shippingMethod: validatedData.shippingMethod,
          notes: validatedData.notes,
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
            totalPrice: Number(item.product.price) * item.quantity,
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
        data: { subtotal: 0 },
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
        },
      });

      return {
        order: completeOrder as OrderWithDetails,
        orderNumber,
      };
    });
  }

  /**
   * Find order by ID
   */
  static async findById(id: string): Promise<OrderWithDetails | null> {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        payment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find order by order number
   */
  static async findByOrderNumber(orderNumber: string): Promise<OrderWithDetails | null> {
    return await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find user orders with filters
   */
  static async findByUser(
    userId: string,
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    orders: OrderWithDetails[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const validatedFilters = OrderFilterSchema.parse(filters);
    const offset = (page - 1) * limit;

    const whereClause: any = { userId };

    if (validatedFilters.status) {
      whereClause.status = validatedFilters.status;
    }

    if (validatedFilters.fromDate || validatedFilters.toDate) {
      whereClause.createdAt = {};
      if (validatedFilters.fromDate) {
        whereClause.createdAt.gte = new Date(validatedFilters.fromDate);
      }
      if (validatedFilters.toDate) {
        const toDate = new Date(validatedFilters.toDate);
        toDate.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = toDate;
      }
    }

    if (validatedFilters.minAmount || validatedFilters.maxAmount) {
      whereClause.totalAmount = {};
      if (validatedFilters.minAmount) {
        whereClause.totalAmount.gte = validatedFilters.minAmount;
      }
      if (validatedFilters.maxAmount) {
        whereClause.totalAmount.lte = validatedFilters.maxAmount;
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update order status
   */
  static async updateStatus(
    id: string,
    data: UpdateOrderStatusData
  ): Promise<OrderWithDetails> {
    const validatedData = UpdateOrderStatusSchema.parse(data);

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    // Validate status transition
    this.validateStatusTransition(order.status, validatedData.status);

    const updateData: any = {
      status: validatedData.status,
    };

    // Set timestamps based on status
    switch (validatedData.status) {
      case OrderStatus.SHIPPED:
        updateData.shippedAt = new Date();
        if (validatedData.trackingNumber) {
          updateData.trackingNumber = validatedData.trackingNumber;
        }
        break;
      case OrderStatus.DELIVERED:
        updateData.deliveredAt = new Date();
        break;
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // TODO: Send notification to customer if notifyCustomer is true
    if (validatedData.notifyCustomer) {
      console.log(`Sending order status notification to user ${updatedOrder.userId}`);
    }

    return updatedOrder;
  }

  /**
   * Cancel order
   */
  static async cancel(
    id: string,
    reason: string,
    userId?: string
  ): Promise<{ success: boolean; refundInfo?: any }> {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          payment: true,
        },
      });

      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }

      // Check if user owns the order
      if (userId && order.userId !== userId) {
        throw new Error('ACCESS_DENIED');
      }

      // Check if order can be cancelled
      if (!this.canBeCancelled(order.status)) {
        throw new Error('ORDER_NOT_CANCELLABLE');
      }

      // Restore inventory
      for (const item of order.items) {
        await ProductModel.updateInventory(
          item.productId,
          item.quantity,
          'increment'
        );
      }

      // Update order status
      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          notes: reason,
        },
      });

      // Calculate refund amount
      const refundAmount = Number(order.totalAmount);

      return {
        success: true,
        refundInfo: {
          amount: refundAmount,
          processingTime: '3-5 business days',
          refundMethod: 'Original payment method',
        },
      };
    });
  }

  /**
   * Get admin orders with filters
   */
  static async findAllWithFilters(
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    orders: OrderWithDetails[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const validatedFilters = OrderFilterSchema.parse(filters);
    const offset = (page - 1) * limit;

    const whereClause: any = {};

    if (validatedFilters.status) {
      whereClause.status = validatedFilters.status;
    }

    if (validatedFilters.fromDate || validatedFilters.toDate) {
      whereClause.createdAt = {};
      if (validatedFilters.fromDate) {
        whereClause.createdAt.gte = new Date(validatedFilters.fromDate);
      }
      if (validatedFilters.toDate) {
        const toDate = new Date(validatedFilters.toDate);
        toDate.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = toDate;
      }
    }

    if (validatedFilters.minAmount || validatedFilters.maxAmount) {
      whereClause.totalAmount = {};
      if (validatedFilters.minAmount) {
        whereClause.totalAmount.gte = validatedFilters.minAmount;
      }
      if (validatedFilters.maxAmount) {
        whereClause.totalAmount.lte = validatedFilters.maxAmount;
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          payment: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get order analytics
   */
  static async getAnalytics(period: 'week' | 'month' | 'year' = 'month'): Promise<OrderAnalytics> {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    const [
      orderStats,
      pendingOrders,
      dailyOrders,
      topProducts,
      paymentMethods,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: { id: true },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
      prisma.order.count({
        where: { status: OrderStatus.PENDING },
      }),
      this.getDailyOrderStats(startDate, endDate),
      this.getTopProducts(startDate, endDate),
      this.getPaymentMethodStats(startDate, endDate),
    ]);

    return {
      summary: {
        totalOrders: orderStats._count.id,
        totalRevenue: Number(orderStats._sum.totalAmount) || 0,
        averageOrderValue: Number(orderStats._avg.totalAmount) || 0,
        pendingOrders,
      },
      trends: {
        dailyOrders,
        topProducts,
        paymentMethods,
      },
    };
  }

  // Helper methods
  private static calculateOrderTotals(
    items: any[],
    shippingMethod: string,
    shippingAddress: any
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

  private static calculateShipping(items: any[], method: string): number {
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

  private static async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const prefix = `PFM${year}${month}${day}`;
    
    // Get today's order count to generate sequence
    const startOfDay = new Date(year, now.getMonth(), now.getDate());
    const endOfDay = new Date(year, now.getMonth(), now.getDate() + 1);

    const todaysOrderCount = await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    const sequence = String(todaysOrderCount + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  private static validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`INVALID_STATUS_TRANSITION_${currentStatus}_TO_${newStatus}`);
    }
  }

  private static canBeCancelled(status: OrderStatus): boolean {
    return [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(status);
  }

  private static async getDailyOrderStats(startDate: Date, endDate: Date) {
    // This would be implemented with a proper aggregation query
    // For now, return mock data
    return [];
  }

  private static async getTopProducts(startDate: Date, endDate: Date) {
    // This would be implemented with proper product analytics
    // For now, return mock data
    return [];
  }

  private static async getPaymentMethodStats(startDate: Date, endDate: Date) {
    // This would be implemented with payment method analytics
    // For now, return mock data
    return [];
  }
}

export { prisma };
export default OrderModel;