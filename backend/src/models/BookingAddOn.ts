// backend/src/models/BookingAddOn.ts
import { PrismaClient, BookingAddOn as PrismaBookingAddOn } from '@prisma/client';

const prisma = new PrismaClient();

export interface BookingAddOn {
  id: string;
  bookingId: string;
  addOnId: string;
  name: string;
  price: number;
}

export class BookingAddOnModel {
  /**
   * Creates a new booking add-on.
   * @param data - The booking add-on data.
   * @returns The created booking add-on.
   */
  static async createBookingAddOn(data: Omit<PrismaBookingAddOn, 'id'>): Promise<PrismaBookingAddOn> {
    return prisma.bookingAddOn.create({
      data,
    });
  }

  /**
   * Finds a booking add-on by its ID.
   * @param id - The booking add-on ID.
   * @returns The booking add-on or null if not found.
   */
  static async findBookingAddOnById(id: string): Promise<PrismaBookingAddOn | null> {
    return prisma.bookingAddOn.findUnique({
      where: { id },
    });
  }

  /**
   * Finds all add-ons for a specific booking.
   * @param bookingId - The booking ID.
   * @returns A list of booking add-ons.
   */
  static async findBookingAddOnsByBookingId(bookingId: string): Promise<PrismaBookingAddOn[]> {
    return prisma.bookingAddOn.findMany({
      where: { bookingId },
    });
  }

  /**
   * Deletes a booking add-on by its ID.
   * @param id - The booking add-on ID.
   */
  static async deleteBookingAddOn(id: string): Promise<PrismaBookingAddOn> {
    return prisma.bookingAddOn.delete({
      where: { id },
    });
  }
}