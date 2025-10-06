/**
 * T024: Payment model and processing
 * Payment entity with provider integration, retry logic, refunds
 */
import { PrismaClient, Payment, PaymentMethod, PaymentProvider, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const CreatePaymentSchema = z.object({
  orderId: z.string().cuid().optional(),
  bookingId: z.string().cuid().optional(),
  amount: z.number().positive().multipleOf(0.01),
  currency: z.string().length(3).default('USD'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  provider: z.nativeEnum(PaymentProvider),
  providerTransactionId: z.string().optional(),
  billingAddress: z.object({
    streetAddress: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }),
  paymentMetadata: z.record(z.any()).optional(),
}).refine((data) => {
  return data.orderId || data.bookingId;
}, "Either orderId or bookingId must be provided");

export const ProcessPaymentSchema = z.object({
  paymentMethodToken: z.string(),
  billingAddress: z.object({
    streetAddress: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }),
  savePaymentMethod: z.boolean().default(false),
  returnUrl: z.string().url().optional(),
});

export const RefundPaymentSchema = z.object({
  amount: z.number().positive().multipleOf(0.01).optional(),
  reason: z.string().min(1).max(500),
});

export type CreatePaymentData = z.infer<typeof CreatePaymentSchema>;
export type ProcessPaymentData = z.infer<typeof ProcessPaymentSchema>;
export type RefundPaymentData = z.infer<typeof RefundPaymentSchema>;

export interface PaymentResult {
  payment: Payment;
  requiresAction?: boolean;
  nextAction?: {
    type: string;
    url: string;
  };
}

export interface RefundResult {
  refund: {
    id: string;
    paymentId: string;
    amount: number;
    status: string;
    reason: string;
    expectedDate: string;
  };
}

export class PaymentModel {
  /**
   * Create a payment record
   */
  static async create(data: CreatePaymentData): Promise<Payment> {
    const validatedData = CreatePaymentSchema.parse(data);

    // Verify that either order or booking exists
    if (validatedData.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: validatedData.orderId },
      });
      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }
    }

    if (validatedData.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: validatedData.bookingId },
      });
      if (!booking) {
        throw new Error('BOOKING_NOT_FOUND');
      }
    }

    const payment = await prisma.payment.create({
      data: validatedData,
    });

    return payment;
  }

  /**
   * Process payment with provider
   */
  static async processPayment(
    paymentId: string,
    data: ProcessPaymentData
  ): Promise<PaymentResult> {
    const validatedData = ProcessPaymentSchema.parse(data);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
        booking: true,
      },
    });

    if (!payment) {
      throw new Error('PAYMENT_NOT_FOUND');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new Error('PAYMENT_ALREADY_COMPLETED');
    }

    try {
      // Update payment to processing
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.PROCESSING },
      });

      // Process payment based on provider
      let result: any;
      switch (payment.provider) {
        case PaymentProvider.STRIPE:
          result = await this.processStripePayment(payment, validatedData);
          break;
        case PaymentProvider.PAYPAL:
          result = await this.processPayPalPayment(payment, validatedData);
          break;
        default:
          throw new Error('UNSUPPORTED_PAYMENT_PROVIDER');
      }

      // Update payment with result
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: result.status,
          providerTransactionId: result.transactionId,
          processedAt: result.status === PaymentStatus.COMPLETED ? new Date() : null,
          failureReason: result.failureReason,
          paymentMetadata: result.metadata,
        },
      });

      return {
        payment: updatedPayment,
        requiresAction: result.requiresAction,
        nextAction: result.nextAction,
      };
    } catch (error) {
      // Update payment to failed
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Retry failed payment
   */
  static async retryPayment(
    paymentId: string,
    data: ProcessPaymentData
  ): Promise<PaymentResult> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('PAYMENT_NOT_FOUND');
    }

    if (payment.status !== PaymentStatus.FAILED) {
      throw new Error('PAYMENT_NOT_FAILED');
    }

    // Reset payment status and increment retry count
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PENDING,
        retryCount: { increment: 1 },
        failedAt: null,
        failureReason: null,
      },
    });

    return await this.processPayment(paymentId, data);
  }

  /**
   * Refund payment
   */
  static async refundPayment(
    paymentId: string,
    data: RefundPaymentData
  ): Promise<RefundResult> {
    const validatedData = RefundPaymentSchema.parse(data);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('PAYMENT_NOT_FOUND');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('PAYMENT_NOT_COMPLETED');
    }

    const refundAmount = validatedData.amount || Number(payment.amount);

    if (refundAmount > Number(payment.amount)) {
      throw new Error('REFUND_AMOUNT_EXCEEDS_PAYMENT');
    }

    try {
      // Process refund with provider
      let refundResult: any;
      switch (payment.provider) {
        case PaymentProvider.STRIPE:
          refundResult = await this.processStripeRefund(payment, refundAmount, validatedData.reason);
          break;
        case PaymentProvider.PAYPAL:
          refundResult = await this.processPayPalRefund(payment, refundAmount, validatedData.reason);
          break;
        default:
          throw new Error('UNSUPPORTED_PAYMENT_PROVIDER');
      }

      // Update payment status if full refund
      if (refundAmount === Number(payment.amount)) {
        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.REFUNDED,
            refundedAt: new Date(),
          },
        });
      }

      return {
        refund: {
          id: refundResult.id,
          paymentId,
          amount: refundAmount,
          status: refundResult.status,
          reason: validatedData.reason,
          expectedDate: this.calculateRefundDate(payment.provider),
        },
      };
    } catch (error) {
      throw new Error(`REFUND_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get payment by ID
   */
  static async findById(id: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
        booking: true,
      },
    });
  }

  /**
   * Get payment by provider transaction ID
   */
  static async findByProviderTransactionId(
    transactionId: string,
    provider: PaymentProvider
  ): Promise<Payment | null> {
    return await prisma.payment.findFirst({
      where: {
        providerTransactionId: transactionId,
        provider,
      },
    });
  }

  /**
   * Handle webhook from payment provider
   */
  static async handleWebhook(
    provider: PaymentProvider,
    eventData: any,
    signature?: string
  ): Promise<void> {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(provider, eventData, signature)) {
      throw new Error('INVALID_WEBHOOK_SIGNATURE');
    }

    switch (provider) {
      case PaymentProvider.STRIPE:
        await this.handleStripeWebhook(eventData);
        break;
      case PaymentProvider.PAYPAL:
        await this.handlePayPalWebhook(eventData);
        break;
      default:
        throw new Error('UNSUPPORTED_PROVIDER_WEBHOOK');
    }
  }

  // Private helper methods for payment processing
  private static async processStripePayment(
    payment: any,
    data: ProcessPaymentData
  ): Promise<any> {
    // Mock Stripe payment processing
    if (data.paymentMethodToken === 'tok_visa') {
      return {
        status: PaymentStatus.COMPLETED,
        transactionId: `pi_mock_${Date.now()}`,
        requiresAction: false,
        metadata: { method: 'visa' },
      };
    } else if (data.paymentMethodToken === 'tok_3ds_required') {
      return {
        status: PaymentStatus.PROCESSING,
        transactionId: `pi_mock_${Date.now()}`,
        requiresAction: true,
        nextAction: {
          type: 'redirect_to_url',
          url: 'https://js.stripe.com/v3/authenticate/mock',
        },
        metadata: { method: '3d_secure' },
      };
    } else if (data.paymentMethodToken === 'tok_chargeDeclined') {
      throw new Error('Your card was declined.');
    } else {
      return {
        status: PaymentStatus.COMPLETED,
        transactionId: `pi_mock_${Date.now()}`,
        requiresAction: false,
        metadata: { method: 'mock' },
      };
    }
  }

  private static async processPayPalPayment(
    payment: any,
    data: ProcessPaymentData
  ): Promise<any> {
    // Mock PayPal payment processing
    return {
      status: PaymentStatus.COMPLETED,
      transactionId: `paypal_mock_${Date.now()}`,
      requiresAction: false,
      metadata: { method: 'paypal' },
    };
  }

  private static async processStripeRefund(
    payment: Payment,
    amount: number,
    reason: string
  ): Promise<any> {
    // Mock Stripe refund processing
    return {
      id: `re_mock_${Date.now()}`,
      status: 'pending',
    };
  }

  private static async processPayPalRefund(
    payment: Payment,
    amount: number,
    reason: string
  ): Promise<any> {
    // Mock PayPal refund processing
    return {
      id: `paypal_refund_${Date.now()}`,
      status: 'pending',
    };
  }

  private static verifyWebhookSignature(
    provider: PaymentProvider,
    eventData: any,
    signature?: string
  ): boolean {
    // Mock signature verification
    return true;
  }

  private static async handleStripeWebhook(eventData: any): Promise<void> {
    // Handle Stripe webhook events
    console.log('Handling Stripe webhook:', eventData.type);
  }

  private static async handlePayPalWebhook(eventData: any): Promise<void> {
    // Handle PayPal webhook events
    console.log('Handling PayPal webhook:', eventData.type);
  }

  private static calculateRefundDate(provider: PaymentProvider): string {
    const date = new Date();
    
    switch (provider) {
      case PaymentProvider.STRIPE:
        date.setDate(date.getDate() + 7); // 5-10 business days
        break;
      case PaymentProvider.PAYPAL:
        date.setDate(date.getDate() + 5); // 3-5 business days
        break;
      default:
        date.setDate(date.getDate() + 7);
        break;
    }

    return date.toISOString().split('T')[0];
  }

  /**
   * Get payment analytics
   */
  static async getAnalytics(fromDate: Date, toDate: Date) {
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    const analytics = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      successfulPayments: payments.filter(p => p.status === PaymentStatus.COMPLETED).length,
      failedPayments: payments.filter(p => p.status === PaymentStatus.FAILED).length,
      refundedPayments: payments.filter(p => p.status === PaymentStatus.REFUNDED).length,
      averageAmount: payments.length > 0 
        ? payments.reduce((sum, p) => sum + Number(p.amount), 0) / payments.length 
        : 0,
      paymentMethods: this.groupByPaymentMethod(payments),
      providers: this.groupByProvider(payments),
    };

    return analytics;
  }

  private static groupByPaymentMethod(payments: Payment[]) {
    const grouped = payments.reduce((acc: Record<string, number>, payment) => {
      acc[payment.paymentMethod] = (acc[payment.paymentMethod] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([method, count]) => ({
      method,
      count,
      percentage: (count / payments.length) * 100,
    }));
  }

  private static groupByProvider(payments: Payment[]) {
    const grouped = payments.reduce((acc: Record<string, number>, payment) => {
      acc[payment.provider] = (acc[payment.provider] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([provider, count]) => ({
      provider,
      count,
      percentage: (count / payments.length) * 100,
    }));
  }
}

export { prisma };
export default PaymentModel;