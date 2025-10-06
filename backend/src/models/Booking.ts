/**
 * T023: Booking model and availability
 * Booking entity with conflict detection, status tracking
 */
import { PrismaClient, Booking, BookingStatus, Service, ServiceAddOn } from '@prisma/client';
import { z } from 'zod';
import ServiceModel from './Service';

const prisma = new PrismaClient();

// Validation schemas
export const CreateBookingSchema = z.object({
  serviceId: z.string().cuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledHour: z.number().int().min(0).max(23),
  selectedAddOns: z.array(z.string().cuid()).default([]),
  vehicleMake: z.string().min(1).max(100).optional(),
  vehicleModel: z.string().min(1).max(100).optional(),
  vehicleYear: z.number().int().min(1900).max(2100).optional(),
  specialInstructions: z.string().max(1000).optional(),
});

export const UpdateBookingSchema = z.object({
  vehicleMake: z.string().min(1).max(100).optional(),
  vehicleModel: z.string().min(1).max(100).optional(),
  vehicleYear: z.number().int().min(1900).max(2100).optional(),
  specialInstructions: z.string().max(1000).optional(),
});

export const UpdateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
  notes: z.string().optional(),
});

export const BookingFilterSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  serviceId: z.string().cuid().optional(),
});

export type CreateBookingData = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingData = z.infer<typeof UpdateBookingSchema>;
export type UpdateBookingStatusData = z.infer<typeof UpdateBookingStatusSchema>;
export type BookingFilters = z.infer<typeof BookingFilterSchema>;

// Booking with full details
export type BookingWithDetails = Booking & {
  service: Service & {
    addOns: ServiceAddOn[];
  };
  selectedAddOns: any[];
  payment?: any;
  user?: any;
};

export interface BookingCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  status: BookingStatus;
  service: string;
  customer: string;
  vehicleInfo?: string;
}

export class BookingModel {
  /**
   * Create a new booking
   */
  static async create(
    userId: string,
    data: CreateBookingData
  ): Promise<{ booking: BookingWithDetails; bookingNumber: string }> {
    const validatedData = CreateBookingSchema.parse(data);

    return await prisma.$transaction(async (tx) => {
      // Validate service exists
      const service = await ServiceModel.findById(validatedData.serviceId);
      if (!service) {
        throw new Error('SERVICE_NOT_FOUND');
      }

      // Parse and validate date
      const scheduledDate = new Date(validatedData.scheduledDate);
      
      // Validate booking date and time
      await this.validateBookingDateTime(
        validatedData.serviceId,
        scheduledDate,
        validatedData.scheduledHour
      );

      // Validate selected add-ons
      const selectedAddOns = await this.validateSelectedAddOns(
        validatedData.serviceId,
        validatedData.selectedAddOns
      );

      // Calculate pricing
      const pricing = this.calculateBookingPrice(service, selectedAddOns);

      // Generate booking number
      const bookingNumber = await this.generateBookingNumber();

      // Create booking
      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          userId,
          serviceId: validatedData.serviceId,
          scheduledDate,
          scheduledHour: validatedData.scheduledHour,
          durationHours: service.durationHours,
          basePrice: service.basePrice,
          addOnsTotal: pricing.addOnsTotal,
          totalAmount: pricing.totalAmount,
          vehicleMake: validatedData.vehicleMake,
          vehicleModel: validatedData.vehicleModel,
          vehicleYear: validatedData.vehicleYear,
          specialInstructions: validatedData.specialInstructions,
        },
        include: {
          service: {
            include: {
              addOns: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      // Create booking add-ons
      if (selectedAddOns.length > 0) {
        await tx.bookingAddOn.createMany({
          data: selectedAddOns.map(addOn => ({
            bookingId: booking.id,
            addOnId: addOn.id,
            name: addOn.name,
            price: addOn.price,
          })),
        });
      }

      // Get complete booking with add-ons
      const completeBooking = await tx.booking.findUnique({
        where: { id: booking.id },
        include: {
          service: {
            include: {
              addOns: true,
            },
          },
          selectedAddOns: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      return {
        booking: completeBooking as BookingWithDetails,
        bookingNumber,
      };
    });
  }

  /**
   * Find booking by ID
   */
  static async findById(id: string): Promise<BookingWithDetails | null> {
    return await prisma.booking.findUnique({
      where: { id },
      include: {
        service: {
          include: {
            addOns: true,
          },
        },
        selectedAddOns: true,
        payment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  /**
   * Find booking by booking number
   */
  static async findByBookingNumber(bookingNumber: string): Promise<BookingWithDetails | null> {
    return await prisma.booking.findUnique({
      where: { bookingNumber },
      include: {
        service: {
          include: {
            addOns: true,
          },
        },
        selectedAddOns: true,
        payment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  /**
   * Find user bookings with filters
   */
  static async findByUser(
    userId: string,
    filters: BookingFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    bookings: BookingWithDetails[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const validatedFilters = BookingFilterSchema.parse(filters);
    const offset = (page - 1) * limit;

    const whereClause: any = { userId };

    if (validatedFilters.status) {
      whereClause.status = validatedFilters.status;
    }

    if (validatedFilters.serviceId) {
      whereClause.serviceId = validatedFilters.serviceId;
    }

    if (validatedFilters.fromDate || validatedFilters.toDate) {
      whereClause.scheduledDate = {};
      if (validatedFilters.fromDate) {
        whereClause.scheduledDate.gte = new Date(validatedFilters.fromDate);
      }
      if (validatedFilters.toDate) {
        whereClause.scheduledDate.lte = new Date(validatedFilters.toDate);
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          service: {
            include: {
              addOns: true,
            },
          },
          selectedAddOns: true,
          payment: true,
        },
        orderBy: { scheduledDate: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update booking details
   */
  static async update(
    id: string,
    userId: string,
    data: UpdateBookingData
  ): Promise<BookingWithDetails> {
    const validatedData = UpdateBookingSchema.parse(data);

    const booking = await prisma.booking.findFirst({
      where: { id, userId },
    });

    if (!booking) {
      throw new Error('BOOKING_NOT_FOUND');
    }

    // Check if booking can be modified
    if (!this.canBeModified(booking.status)) {
      throw new Error('BOOKING_CANNOT_BE_MODIFIED');
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: validatedData,
      include: {
        service: {
          include: {
            addOns: true,
          },
        },
        selectedAddOns: true,
        payment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return updatedBooking;
  }

  /**
   * Update booking status (admin)
   */
  static async updateStatus(
    id: string,
    data: UpdateBookingStatusData
  ): Promise<BookingWithDetails> {
    const validatedData = UpdateBookingStatusSchema.parse(data);

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new Error('BOOKING_NOT_FOUND');
    }

    // Validate status transition
    this.validateStatusTransition(booking.status, validatedData.status);

    const updateData: any = {
      status: validatedData.status,
    };

    // Set timestamps based on status
    switch (validatedData.status) {
      case BookingStatus.CONFIRMED:
        updateData.confirmedAt = new Date();
        break;
      case BookingStatus.COMPLETED:
        updateData.completedAt = new Date();
        break;
    }

    if (validatedData.notes) {
      updateData.notes = validatedData.notes;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        service: {
          include: {
            addOns: true,
          },
        },
        selectedAddOns: true,
        payment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return updatedBooking;
  }

  /**
   * Cancel booking
   */
  static async cancel(
    id: string,
    reason: string,
    userId?: string
  ): Promise<{ success: boolean; refundInfo?: any }> {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: {
          payment: true,
        },
      });

      if (!booking) {
        throw new Error('BOOKING_NOT_FOUND');
      }

      // Check if user owns the booking
      if (userId && booking.userId !== userId) {
        throw new Error('ACCESS_DENIED');
      }

      // Check if booking can be cancelled
      if (!this.canBeCancelled(booking.status, booking.scheduledDate)) {
        throw new Error('BOOKING_CANNOT_BE_CANCELLED');
      }

      // Update booking status
      await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          notes: reason,
        },
      });

      // Calculate refund amount (based on cancellation policy)
      const refundAmount = this.calculateRefundAmount(booking);

      return {
        success: true,
        refundInfo: {
          amount: refundAmount,
          processingTime: '3-5 business days',
          cancellationFee: Number(booking.totalAmount) - refundAmount,
        },
      };
    });
  }

  /**
   * Get calendar events for admin
   */
  static async getCalendarEvents(
    fromDate: string,
    toDate: string
  ): Promise<BookingCalendarEvent[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        scheduledDate: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS, BookingStatus.PENDING],
        },
      },
      include: {
        service: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return bookings.map(booking => {
      const start = new Date(booking.scheduledDate);
      start.setHours(booking.scheduledHour);
      
      const end = new Date(start);
      end.setHours(start.getHours() + booking.durationHours);

      const vehicleInfo = booking.vehicleMake && booking.vehicleModel
        ? `${booking.vehicleMake} ${booking.vehicleModel}${booking.vehicleYear ? ` (${booking.vehicleYear})` : ''}`
        : undefined;

      return {
        id: booking.id,
        title: `${booking.service.name} - ${booking.user.firstName} ${booking.user.lastName}`,
        start: start.toISOString(),
        end: end.toISOString(),
        status: booking.status,
        service: booking.service.name,
        customer: `${booking.user.firstName} ${booking.user.lastName}`,
        vehicleInfo,
      };
    });
  }

  /**
   * Get admin bookings with filters
   */
  static async findAllWithFilters(
    filters: BookingFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    bookings: BookingWithDetails[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const validatedFilters = BookingFilterSchema.parse(filters);
    const offset = (page - 1) * limit;

    const whereClause: any = {};

    if (validatedFilters.status) {
      whereClause.status = validatedFilters.status;
    }

    if (validatedFilters.serviceId) {
      whereClause.serviceId = validatedFilters.serviceId;
    }

    if (validatedFilters.fromDate || validatedFilters.toDate) {
      whereClause.scheduledDate = {};
      if (validatedFilters.fromDate) {
        whereClause.scheduledDate.gte = new Date(validatedFilters.fromDate);
      }
      if (validatedFilters.toDate) {
        whereClause.scheduledDate.lte = new Date(validatedFilters.toDate);
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          service: {
            include: {
              addOns: true,
            },
          },
          selectedAddOns: true,
          payment: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { scheduledDate: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Helper methods
  private static async validateBookingDateTime(
    serviceId: string,
    date: Date,
    hour: number
  ): Promise<void> {
    // Check if time slot is available
    const isAvailable = await ServiceModel.isTimeSlotAvailable(serviceId, date, hour);
    if (!isAvailable) {
      throw new Error('TIME_SLOT_UNAVAILABLE');
    }

    // Additional validation for booking window
    const now = new Date();
    const daysDiff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const service = await ServiceModel.findById(serviceId);
    if (!service) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    if (daysDiff < service.advanceBookingDays) {
      throw new Error('BOOKING_TOO_SOON');
    }

    if (daysDiff > service.maxAdvanceBookingDays) {
      throw new Error('BOOKING_TOO_FAR');
    }

    // Check if date is valid (not in the past)
    if (date < now) {
      throw new Error('INVALID_BOOKING_DATE');
    }
  }

  private static async validateSelectedAddOns(
    serviceId: string,
    addOnIds: string[]
  ): Promise<any[]> {
    if (addOnIds.length === 0) {
      return [];
    }

    const addOns = await prisma.serviceAddOn.findMany({
      where: {
        id: { in: addOnIds },
        serviceId,
      },
    });

    if (addOns.length !== addOnIds.length) {
      throw new Error('INVALID_ADD_ONS');
    }

    return addOns;
  }

  private static calculateBookingPrice(service: any, selectedAddOns: any[]): {
    basePrice: number;
    addOnsTotal: number;
    totalAmount: number;
  } {
    const basePrice = Number(service.basePrice);
    const addOnsTotal = selectedAddOns.reduce(
      (sum, addOn) => sum + Number(addOn.price),
      0
    );

    return {
      basePrice,
      addOnsTotal,
      totalAmount: basePrice + addOnsTotal,
    };
  }

  private static async generateBookingNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const prefix = `BK${year}${month}${day}`;
    
    // Get today's booking count to generate sequence
    const startOfDay = new Date(year, now.getMonth(), now.getDate());
    const endOfDay = new Date(year, now.getMonth(), now.getDate() + 1);

    const todaysBookingCount = await prisma.booking.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    const sequence = String(todaysBookingCount + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  private static validateStatusTransition(
    currentStatus: BookingStatus,
    newStatus: BookingStatus
  ): void {
    const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
      [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.NO_SHOW]: [],
    };

    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`INVALID_STATUS_TRANSITION_${currentStatus}_TO_${newStatus}`);
    }
  }

  private static canBeModified(status: BookingStatus): boolean {
    return [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(status);
  }

  private static canBeCancelled(status: BookingStatus, scheduledDate: Date): boolean {
    if (![BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(status)) {
      return false;
    }

    // Check if cancellation is within allowed timeframe (24 hours)
    const now = new Date();
    const hoursUntilBooking = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursUntilBooking > 24;
  }

  private static calculateRefundAmount(booking: any): number {
    const now = new Date();
    const hoursUntilBooking = (booking.scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const totalAmount = Number(booking.totalAmount);

    // Cancellation policy
    if (hoursUntilBooking > 48) {
      return totalAmount; // Full refund
    } else if (hoursUntilBooking > 24) {
      return totalAmount * 0.5; // 50% refund
    } else {
      return 0; // No refund
    }
  }
}

export { prisma };
export default BookingModel;