// backend/src/models/Payment.ts
import { PrismaClient, Payment as PrismaPayment, PaymentMethod, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface Payment {
  id: string;
  orderId?: string;
  bookingId?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  provider: PaymentProvider;
  providerTransactionId?: string;
  providerFee?: number;
  status: PaymentStatus;
  createdAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
  failureReason?: string;
  retryCount: number;
  billingAddress: Prisma.JsonValue; // JSON type in Prisma
  paymentMetadata?: Prisma.JsonValue; // JSON type in Prisma
}

export class PaymentModel {
  /**
   * Creates a new payment record.
   * @param data - The payment data.
   * @returns The created payment.
   */
  static async createPayment(data: Omit<PrismaPayment, 'id' | 'createdAt' | 'retryCount' | 'status' | 'billingAddress' | 'paymentMetadata'> & { status?: PaymentStatus, retryCount?: number, billingAddress: Prisma.InputJsonValue, paymentMetadata?: Prisma.InputJsonValue }): Promise<PrismaPayment> {
    return prisma.payment.create({
      data: {
        ...data,
        status: data.status || 'PENDING',
        retryCount: data.retryCount || 0,
        billingAddress: data.billingAddress as Prisma.InputJsonValue,
        paymentMetadata: data.paymentMetadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Finds a payment by its ID.
   * @param id - The payment ID.
   * @returns The payment or null if not found.
   */
  static async findPaymentById(id: string): Promise<PrismaPayment | null> {
    return prisma.payment.findUnique({
      where: { id },
    });
  }

  /**
   * Finds a payment by order ID.
   * @param orderId - The order ID.
   * @returns The payment or null if not found.
   */
  static async findPaymentByOrderId(orderId: string): Promise<PrismaPayment | null> {
    return prisma.payment.findUnique({
      where: { orderId },
    });
  }

  /**
   * Finds a payment by booking ID.
   * @param bookingId - The booking ID.
   * @returns The payment or null if not found.
   */
  static async findPaymentByBookingId(bookingId: string): Promise<PrismaPayment | null> {
    return prisma.payment.findUnique({
      where: { bookingId },
    });
  }

  /**
   * Updates an existing payment.
   * @param id - The payment ID.
   * @param data - The update data.
   * @returns The updated payment.
   */
  static async updatePayment(id: string, data: Partial<Omit<PrismaPayment, 'billingAddress' | 'paymentMetadata'>> & { billingAddress?: Prisma.InputJsonValue, paymentMetadata?: Prisma.InputJsonValue }): Promise<PrismaPayment> {
    return prisma.payment.update({
      where: { id },
      data: {
        ...data,
        billingAddress: data.billingAddress as Prisma.InputJsonValue,
        paymentMetadata: data.paymentMetadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Finds payments by status.
   * @param status - The payment status.
   * @returns A list of payments.
   */
  static async findPaymentsByStatus(status: PaymentStatus): Promise<PrismaPayment[]> {
    return prisma.payment.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
  }
}