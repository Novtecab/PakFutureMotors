// backend/src/models/Booking.ts
import { PrismaClient, Booking as PrismaBooking } from '@prisma/client';

const prisma = new PrismaClient();

export interface Booking {
  id: string;
  userId: string;
  serviceId: string;
  date: Date;
  startTime: string; // e.g., "09:00"
  endTime: string;   // e.g., "10:00"
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  totalPrice: number;
  vehicleInfo?: string; // Optional: Make, Model, Year
  createdAt: Date;
  updatedAt: Date;
}

export class BookingModel {
  /**
   * Creates a new booking.
   * @param data - The booking data.
   * @returns The created booking.
   */
  static async createBooking(data: Omit<PrismaBooking, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' }): Promise<PrismaBooking> {
    return prisma.booking.create({
      data: {
        ...data,
        status: data.status || 'PENDING',
      },
    });
  }

  /**
   * Finds a booking by its ID.
   * @param id - The booking ID.
   * @returns The booking or null if not found.
   */
  static async findBookingById(id: string): Promise<PrismaBooking | null> {
    return prisma.booking.findUnique({
      where: { id },
    });
  }

  /**
   * Updates an existing booking.
   * @param id - The booking ID.
   * @param data - The update data.
   * @returns The updated booking.
   */
  static async updateBooking(id: string, data: Partial<PrismaBooking>): Promise<PrismaBooking> {
    return prisma.booking.update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes a booking by its ID.
   * @param id - The booking ID.
   */
  static async deleteBooking(id: string): Promise<PrismaBooking> {
    return prisma.booking.delete({
      where: { id },
    });
  }

  /**
   * Finds all bookings for a specific user.
   * @param userId - The user ID.
   * @returns A list of bookings.
   */
  static async findBookingsByUserId(userId: string): Promise<PrismaBooking[]> {
    return prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds all bookings for a specific service.
   * @param serviceId - The service ID.
   * @returns A list of bookings.
   */
  static async findBookingsByServiceId(serviceId: string): Promise<PrismaBooking[]> {
    return prisma.booking.findMany({
      where: { serviceId },
      orderBy: { scheduledDate: 'asc', scheduledHour: 'asc' },
    });
  }
}