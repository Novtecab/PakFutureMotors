// backend/src/services/BookingService.ts
import { Booking, Service, BookingStatus, Prisma, ServiceAddOn } from '@prisma/client';
import { BookingModel } from '../models/Booking';
import { ServiceModel } from '../models/Service';
import { BookingAddOnModel } from '../models/BookingAddOn'; // Import BookingAddOnModel
import { z } from 'zod';

// Zod schema for creating a booking
export const CreateBookingSchema = z.object({
  userId: z.string().cuid(),
  serviceId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  vehicleInfo: z.string().optional(),
  addOnIds: z.array(z.string().cuid()).optional(),
});

export type CreateBookingData = z.infer<typeof CreateBookingSchema>;

// Zod schema for updating a booking
export const UpdateBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.nativeEnum(BookingStatus).optional(),
  vehicleInfo: z.string().optional(),
  addOnIds: z.array(z.string().cuid()).optional(),
}).strict();

export type UpdateBookingData = z.infer<typeof UpdateBookingSchema>;

export class BookingService {
  /**
   * Creates a new service booking.
   * @param data - The booking data.
   * @returns The created booking.
   */
  static async createBooking(data: CreateBookingData): Promise<Booking> {
    const validatedData = CreateBookingSchema.parse(data);

    const service = await ServiceModel.findById(validatedData.serviceId);
    if (!service) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    // Calculate end time based on service duration
    const [startHour, startMinute] = validatedData.startTime.split(':').map(Number);
    const startDate = new Date(validatedData.date);
    startDate.setUTCHours(startHour, startMinute, 0, 0);

    // Check for booking conflicts
    const conflicts = await BookingModel.findBookingsByServiceId(validatedData.serviceId);
    const hasConflict = conflicts.some(
      (existingBooking) =>
        existingBooking.scheduledDate.toISOString().split('T')[0] === validatedData.date &&
        existingBooking.scheduledHour === startHour
    );

    if (hasConflict) {
      throw new Error('BOOKING_SLOT_UNAVAILABLE');
    }

    // Calculate total price including add-ons
    let totalAddOnsPrice = 0;
    let addOns: ServiceAddOn[] = [];
    if (validatedData.addOnIds && validatedData.addOnIds.length > 0) {
      addOns = await ServiceModel.findAddOnsByIds(validatedData.addOnIds);
      totalAddOnsPrice = addOns.reduce((sum: number, addOn: ServiceAddOn) => sum + Number(addOn.price), 0);
    }

    const totalPrice = Number(service.basePrice) + totalAddOnsPrice;

    const newBooking = await BookingModel.createBooking({
      userId: validatedData.userId,
      serviceId: validatedData.serviceId,
      bookingNumber: `BKG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`, // Generate unique booking number
      scheduledDate: startDate,
      scheduledHour: startHour,
      durationHours: service.durationHours,
      basePrice: service.basePrice,
      addOnsTotal: new Prisma.Decimal(totalAddOnsPrice), // Convert to Prisma.Decimal
      totalAmount: new Prisma.Decimal(totalPrice),
      currency: service.currency,
      vehicleMake: validatedData.vehicleInfo?.split(',')[0]?.trim() || null,
      vehicleModel: validatedData.vehicleInfo?.split(',')[1]?.trim() || null,
      vehicleYear: validatedData.vehicleInfo ? (parseInt(validatedData.vehicleInfo.split(',')[2]?.trim()) || null) : null,
      specialInstructions: validatedData.vehicleInfo || null,
      status: 'PENDING',
      confirmedAt: null,
      completedAt: null,
      notes: null,
    });

    // Add booking add-ons
    if (addOns.length > 0) {
      for (const addOn of addOns) {
        await BookingAddOnModel.createBookingAddOn({
          bookingId: newBooking.id,
          addOnId: addOn.id,
          name: addOn.name,
          price: new Prisma.Decimal(Number(addOn.price)), // Convert to Prisma.Decimal
        });
      }
    }

    return newBooking;
  }

  /**
   * Retrieves a booking by its ID.
   * @param bookingId - The ID of the booking.
   * @returns The booking or null if not found.
   */
  static async getBookingById(bookingId: string): Promise<Booking | null> {
    return BookingModel.findBookingById(bookingId);
  }

  /**
   * Updates an existing booking.
   * @param bookingId - The ID of the booking to update.
   * @param data - The update data.
   * @returns The updated booking.
   */
  static async updateBooking(bookingId: string, data: UpdateBookingData): Promise<Booking> {
    const validatedData = UpdateBookingSchema.parse(data);
    return BookingModel.updateBooking(bookingId, validatedData);
  }

  /**
   * Cancels a booking.
   * @param bookingId - The ID of the booking to cancel.
   * @returns The cancelled booking.
   */
  static async cancelBooking(bookingId: string): Promise<Booking> {
    return BookingModel.updateBooking(bookingId, { status: BookingStatus.CANCELLED });
  }

  /**
   * Retrieves all bookings for a specific user.
   * @param userId - The ID of the user.
   * @returns A list of bookings.
   */
  static async getUserBookings(userId: string): Promise<Booking[]> {
    return BookingModel.findBookingsByUserId(userId);
  }

  /**
   * Checks service availability for a given date range.
   * @param serviceId - The ID of the service.
   * @param startDate - The start date (YYYY-MM-DD).
   * @param endDate - The end date (YYYY-MM-DD).
   * @returns A list of available slots.
   */
  static async getServiceAvailability(
    serviceId: string,
    startDate: string,
    endDate: string
  ): Promise<{ date: string; slots: string[] }[]> {
    const service = await ServiceModel.findById(serviceId);
    if (!service) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    const availableSlots: { date: string; slots: string[] }[] = [];
    const existingBookings = await BookingModel.findBookingsByServiceId(serviceId);

    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getUTCDay(); // 0 for Sunday, 6 for Saturday
      const dateString = currentDate.toISOString().split('T')[0];

      if (service.availableDays.includes(dayOfWeek)) {
        const daySlots: string[] = [];
        const availableHours = service.availableHours as unknown as Array<{ start_hour: number; end_hour: number }>;

        for (const hourRange of availableHours) {
          for (let hour = hourRange.start_hour; hour < hourRange.end_hour; hour += service.durationHours) {
            const slotTime = `${hour.toString().padStart(2, '0')}:00`;

            // Check for conflicts with existing bookings
            const isBooked = existingBookings.some(
              (booking) =>
                booking.scheduledDate.toISOString().split('T')[0] === dateString &&
                booking.scheduledHour === hour &&
                (booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.PENDING)
            );

            if (!isBooked) {
              daySlots.push(slotTime);
            }
          }
        }
        if (daySlots.length > 0) {
          availableSlots.push({ date: dateString, slots: daySlots });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots;
  }
}