// backend/src/models/Service.ts
import { PrismaClient, Service, ServiceAddOn, ServiceCategory, ServiceStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const CreateServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.nativeEnum(ServiceCategory),
  basePrice: z.number().positive().multipleOf(0.01),
  currency: z.string().length(3).default('USD'),
  durationHours: z.number().int().min(1).max(24).default(1),
  advanceBookingDays: z.number().int().min(0).default(0),
  maxAdvanceBookingDays: z.number().int().min(0).default(365),
  availableDays: z.array(z.number().int().min(0).max(6)).min(1), // 0 for Sunday, 6 for Saturday
  availableHours: z.array(z.object({
    start_hour: z.number().int().min(0).max(23),
    end_hour: z.number().int().min(0).max(23),
  })).min(1),
  maxDailyBookings: z.number().int().min(1).default(10),
  preparationInstructions: z.string().optional(),
  requirements: z.string().optional(),
  status: z.nativeEnum(ServiceStatus).default(ServiceStatus.ACTIVE),
  featured: z.boolean().default(false),
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export const CreateServiceAddOnSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  price: z.number().positive().multipleOf(0.01),
  required: z.boolean().default(false),
});

export type CreateServiceData = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceData = z.infer<typeof UpdateServiceSchema>;
export type CreateServiceAddOnData = z.infer<typeof CreateServiceAddOnSchema>;

export type ServiceWithAddOns = Service & {
  addOns: ServiceAddOn[];
};

export class ServiceModel {
  /**
   * Creates a new service.
   * @param data - The service data.
   * @returns The created service.
   */
  static async create(data: CreateServiceData): Promise<Service> {
    const validatedData = CreateServiceSchema.parse(data);
    return prisma.service.create({
      data: {
        ...validatedData,
        basePrice: new Prisma.Decimal(validatedData.basePrice),
        availableHours: validatedData.availableHours as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Finds a service by its ID.
   * @param id - The service ID.
   * @returns The service or null if not found.
   */
  static async findById(id: string): Promise<ServiceWithAddOns | null> {
    return prisma.service.findUnique({
      where: { id },
      include: {
        addOns: true,
      },
    });
  }

  /**
   * Finds all services.
   * @returns A list of services.
   */
  static async findAll(): Promise<ServiceWithAddOns[]> {
    return prisma.service.findMany({
      include: {
        addOns: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Updates an existing service.
   * @param id - The service ID.
   * @param data - The update data.
   * @returns The updated service.
   */
  static async update(id: string, data: UpdateServiceData): Promise<Service> {
    const validatedData = UpdateServiceSchema.parse(data);
    return prisma.service.update({
      where: { id },
      data: {
        ...validatedData,
        basePrice: validatedData.basePrice ? new Prisma.Decimal(validatedData.basePrice) : undefined,
        availableHours: validatedData.availableHours ? validatedData.availableHours as Prisma.InputJsonValue : undefined,
      },
    });
  }

  /**
   * Deletes a service (soft delete).
   * @param id - The service ID.
   */
  static async delete(id: string): Promise<Service> {
    return prisma.service.update({
      where: { id },
      data: { status: ServiceStatus.INACTIVE },
    });
  }

  /**
   * Adds an add-on to a service.
   * @param serviceId - The ID of the service.
   * @param data - The add-on data.
   * @returns The created service add-on.
   */
  static async addAddOn(serviceId: string, data: CreateServiceAddOnData): Promise<ServiceAddOn> {
    const validatedData = CreateServiceAddOnSchema.parse(data);
    return prisma.serviceAddOn.create({
      data: {
        ...validatedData,
        serviceId,
        price: new Prisma.Decimal(validatedData.price),
      },
    });
  }

  /**
   * Finds add-ons by their IDs.
   * @param ids - An array of add-on IDs.
   * @returns A list of service add-ons.
   */
  static async findAddOnsByIds(ids: string[]): Promise<ServiceAddOn[]> {
    return prisma.serviceAddOn.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  /**
   * Updates a service add-on.
   * @param id - The add-on ID.
   * @param data - The update data.
   * @returns The updated service add-on.
   */
  static async updateAddOn(id: string, data: Partial<CreateServiceAddOnData>): Promise<ServiceAddOn> {
    return prisma.serviceAddOn.update({
      where: { id },
      data: {
        ...data,
        price: data.price ? new Prisma.Decimal(data.price) : undefined,
      },
    });
  }

  /**
   * Deletes a service add-on.
   * @param id - The add-on ID.
   */
  static async deleteAddOn(id: string): Promise<ServiceAddOn> {
    return prisma.serviceAddOn.delete({
      where: { id },
    });
  }
}

export { prisma };
export default ServiceModel;