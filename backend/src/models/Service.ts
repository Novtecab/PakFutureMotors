/**
 * T021: Service model and scheduling
 * Service entity with pricing structure, availability, add-ons
 */
import { PrismaClient, Service, ServiceAddOn, ServiceCategory, ServiceStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const AvailableHoursSchema = z.array(z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
})).refine((hours) => {
  return hours.every(slot => slot.startHour < slot.endHour);
}, "Start hour must be less than end hour");

export const CreateServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.nativeEnum(ServiceCategory),
  basePrice: z.number().positive().multipleOf(0.01),
  currency: z.string().length(3).default('USD'),
  durationHours: z.number().int().min(1).max(12).default(1),
  advanceBookingDays: z.number().int().min(0).max(365).default(1),
  maxAdvanceBookingDays: z.number().int().min(1).max(365).default(30),
  availableDays: z.array(z.number().int().min(0).max(6)).min(1), // 0=Sunday, 6=Saturday
  availableHours: AvailableHoursSchema,
  maxDailyBookings: z.number().int().min(1).default(10),
  preparationInstructions: z.string().optional(),
  requirements: z.string().optional(),
  featured: z.boolean().default(false),
  status: z.nativeEnum(ServiceStatus).default(ServiceStatus.ACTIVE),
}).refine((data) => {
  return data.maxAdvanceBookingDays >= data.advanceBookingDays;
}, "Max advance booking days must be >= advance booking days");

export const UpdateServiceSchema = CreateServiceSchema.partial();

export const CreateServiceAddOnSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  price: z.number().positive().multipleOf(0.01),
  required: z.boolean().default(false),
});

export const ServiceFilterSchema = z.object({
  category: z.nativeEnum(ServiceCategory).optional(),
  featured: z.boolean().optional(),
  status: z.nativeEnum(ServiceStatus).optional(),
  availableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
});

export const AvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().int().min(1).max(90).default(30),
});

export type CreateServiceData = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceData = z.infer<typeof UpdateServiceSchema>;
export type CreateServiceAddOnData = z.infer<typeof CreateServiceAddOnSchema>;
export type ServiceFilters = z.infer<typeof ServiceFilterSchema>;
export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

// Service with add-ons type
export type ServiceWithAddOns = Service & {
  addOns: ServiceAddOn[];
};

export interface ServiceAvailability {
  serviceId: string;
  availability: DayAvailability[];
}

export interface DayAvailability {
  date: string;
  availableSlots: TimeSlot[];
  bookedSlots: TimeSlot[];
  blockedSlots: TimeSlot[];
}

export interface TimeSlot {
  startHour: number;
  endHour: number;
  available?: boolean;
  reason?: string;
}

export class ServiceModel {
  /**
   * Create a new service
   */
  static async create(data: CreateServiceData): Promise<ServiceWithAddOns> {
    const validatedData = CreateServiceSchema.parse(data);

    // Validate available hours don't overlap
    this.validateAvailableHours(validatedData.availableHours);

    const service = await prisma.service.create({
      data: {
        ...validatedData,
        availableHours: validatedData.availableHours,
      },
      include: {
        addOns: true,
      },
    });

    return service;
  }

  /**
   * Find service by ID
   */
  static async findById(id: string): Promise<ServiceWithAddOns | null> {
    return await prisma.service.findUnique({
      where: { id },
      include: {
        addOns: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * Find services with filters
   */
  static async findMany(filters: ServiceFilters = {}): Promise<ServiceWithAddOns[]> {
    const validatedFilters = ServiceFilterSchema.parse(filters);

    const whereClause: any = {
      status: validatedFilters.status || ServiceStatus.ACTIVE,
    };

    if (validatedFilters.category) {
      whereClause.category = validatedFilters.category;
    }

    if (validatedFilters.featured !== undefined) {
      whereClause.featured = validatedFilters.featured;
    }

    if (validatedFilters.minPrice || validatedFilters.maxPrice) {
      whereClause.basePrice = {};
      if (validatedFilters.minPrice) {
        whereClause.basePrice.gte = validatedFilters.minPrice;
      }
      if (validatedFilters.maxPrice) {
        whereClause.basePrice.lte = validatedFilters.maxPrice;
      }
    }

    // If filtering by available date, check service availability
    if (validatedFilters.availableDate) {
      const dateAvailableServices = await this.getServicesAvailableOnDate(
        validatedFilters.availableDate
      );
      whereClause.id = { in: dateAvailableServices };
    }

    return await prisma.service.findMany({
      where: whereClause,
      include: {
        addOns: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [
        { featured: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Update service
   */
  static async update(id: string, data: UpdateServiceData): Promise<ServiceWithAddOns> {
    const validatedData = UpdateServiceSchema.parse(data);

    const existingService = await prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    // Validate available hours if provided
    if (validatedData.availableHours) {
      this.validateAvailableHours(validatedData.availableHours);
    }

    return await prisma.service.update({
      where: { id },
      data: validatedData,
      include: {
        addOns: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * Delete service (soft delete)
   */
  static async delete(id: string): Promise<void> {
    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    await prisma.service.update({
      where: { id },
      data: { status: ServiceStatus.INACTIVE },
    });
  }

  /**
   * Check service availability for date range
   */
  static async checkAvailability(
    serviceId: string,
    query: AvailabilityQuery
  ): Promise<ServiceAvailability> {
    const validatedQuery = AvailabilityQuerySchema.parse(query);

    const service = await this.findById(serviceId);
    if (!service) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    const startDate = validatedQuery.date ? new Date(validatedQuery.date) : new Date();
    const availability: DayAvailability[] = [];

    for (let i = 0; i < validatedQuery.days; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() + i);
      
      const dayAvailability = await this.checkDayAvailability(service, checkDate);
      availability.push(dayAvailability);
    }

    return {
      serviceId,
      availability,
    };
  }

  /**
   * Check if service is available at specific date/time
   */
  static async isTimeSlotAvailable(
    serviceId: string,
    date: Date,
    hour: number
  ): Promise<boolean> {
    const service = await this.findById(serviceId);
    if (!service) {
      return false;
    }

    // Check if date is within booking window
    const now = new Date();
    const daysDiff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < service.advanceBookingDays || daysDiff > service.maxAdvanceBookingDays) {
      return false;
    }

    // Check if day of week is available
    const dayOfWeek = date.getDay();
    if (!service.availableDays.includes(dayOfWeek)) {
      return false;
    }

    // Check if hour is within available hours
    const availableHours = service.availableHours as any[];
    const isHourAvailable = availableHours.some(slot => 
      hour >= slot.startHour && hour < slot.endHour
    );

    if (!isHourAvailable) {
      return false;
    }

    // Check existing bookings
    const dateString = date.toISOString().split('T')[0];
    const existingBookings = await prisma.booking.count({
      where: {
        serviceId,
        scheduledDate: new Date(dateString),
        scheduledHour: hour,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      },
    });

    // Check daily booking limit
    const dailyBookings = await prisma.booking.count({
      where: {
        serviceId,
        scheduledDate: new Date(dateString),
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      },
    });

    return existingBookings === 0 && dailyBookings < service.maxDailyBookings;
  }

  /**
   * Block time for service (maintenance, etc.)
   */
  static async blockTime(
    serviceId: string,
    date: Date,
    startHour: number,
    endHour: number,
    reason: string
  ): Promise<void> {
    // Implementation would store blocked times in a separate table
    // For now, this is a placeholder
    console.log(`Blocking time for service ${serviceId} on ${date} from ${startHour} to ${endHour}: ${reason}`);
  }

  // Private helper methods
  private static validateAvailableHours(hours: any[]): void {
    // Check for overlapping time slots
    for (let i = 0; i < hours.length; i++) {
      for (let j = i + 1; j < hours.length; j++) {
        const slot1 = hours[i];
        const slot2 = hours[j];
        
        if (
          (slot1.startHour < slot2.endHour && slot1.endHour > slot2.startHour) ||
          (slot2.startHour < slot1.endHour && slot2.endHour > slot1.startHour)
        ) {
          throw new Error('OVERLAPPING_TIME_SLOTS');
        }
      }
    }
  }

  private static async checkDayAvailability(
    service: ServiceWithAddOns,
    date: Date
  ): Promise<DayAvailability> {
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Check if day is available
    if (!service.availableDays.includes(dayOfWeek)) {
      return {
        date: dateString,
        availableSlots: [],
        bookedSlots: [],
        blockedSlots: [],
      };
    }

    // Check if date is within booking window
    const now = new Date();
    const daysDiff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < service.advanceBookingDays || daysDiff > service.maxAdvanceBookingDays) {
      return {
        date: dateString,
        availableSlots: [],
        bookedSlots: [],
        blockedSlots: [],
      };
    }

    // Get existing bookings for the day
    const existingBookings = await prisma.booking.findMany({
      where: {
        serviceId: service.id,
        scheduledDate: new Date(dateString),
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      },
      select: { scheduledHour: true, durationHours: true },
    });

    const availableHours = service.availableHours as any[];
    const availableSlots: TimeSlot[] = [];
    const bookedSlots: TimeSlot[] = [];
    const blockedSlots: TimeSlot[] = [];

    // Generate all possible time slots
    for (const timeSlot of availableHours) {
      for (let hour = timeSlot.startHour; hour < timeSlot.endHour; hour++) {
        const isBooked = existingBookings.some(booking => 
          hour >= booking.scheduledHour && 
          hour < booking.scheduledHour + booking.durationHours
        );

        const slot: TimeSlot = {
          startHour: hour,
          endHour: hour + service.durationHours,
        };

        if (isBooked) {
          bookedSlots.push(slot);
        } else {
          // Check daily limit
          const dailyBookings = existingBookings.length;
          if (dailyBookings >= service.maxDailyBookings) {
            blockedSlots.push({ ...slot, reason: 'Daily limit reached' });
          } else {
            availableSlots.push({ ...slot, available: true });
          }
        }
      }
    }

    return {
      date: dateString,
      availableSlots,
      bookedSlots,
      blockedSlots,
    };
  }

  private static async getServicesAvailableOnDate(dateString: string): Promise<string[]> {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();

    const services = await prisma.service.findMany({
      where: {
        status: ServiceStatus.ACTIVE,
        availableDays: { has: dayOfWeek },
      },
      select: { id: true },
    });

    // Filter by booking window and availability
    const availableServices: string[] = [];
    
    for (const service of services) {
      const isAvailable = await this.isTimeSlotAvailable(service.id, date, 9); // Check 9 AM as example
      if (isAvailable) {
        availableServices.push(service.id);
      }
    }

    return availableServices;
  }
}

export class ServiceAddOnModel {
  /**
   * Create add-on for service
   */
  static async create(serviceId: string, data: CreateServiceAddOnData): Promise<ServiceAddOn> {
    const validatedData = CreateServiceAddOnSchema.parse(data);

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    return await prisma.serviceAddOn.create({
      data: {
        ...validatedData,
        serviceId,
      },
    });
  }

  /**
   * Update add-on
   */
  static async update(
    id: string, 
    data: Partial<CreateServiceAddOnData>
  ): Promise<ServiceAddOn> {
    const addOn = await prisma.serviceAddOn.findUnique({
      where: { id },
    });

    if (!addOn) {
      throw new Error('ADD_ON_NOT_FOUND');
    }

    return await prisma.serviceAddOn.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete add-on
   */
  static async delete(id: string): Promise<void> {
    const addOn = await prisma.serviceAddOn.findUnique({
      where: { id },
    });

    if (!addOn) {
      throw new Error('ADD_ON_NOT_FOUND');
    }

    await prisma.serviceAddOn.delete({
      where: { id },
    });
  }

  /**
   * Get add-ons for service
   */
  static async findByService(serviceId: string): Promise<ServiceAddOn[]> {
    return await prisma.serviceAddOn.findMany({
      where: { serviceId },
      orderBy: [
        { required: 'desc' },
        { name: 'asc' },
      ],
    });
  }
}

export { prisma };
export default ServiceModel;