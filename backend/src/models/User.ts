/**
 * T019: User model and authentication
 * User entity with multi-auth support, address management, validation
 */
import { PrismaClient, User, Address, UserStatus, AddressType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const CreateUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  authProvider: z.enum(['email', 'google', 'facebook', 'phone']),
  socialToken: z.string().optional(),
  verificationCode: z.string().optional(),
  avatarUrl: z.string().url().optional(),
}).refine((data) => {
  // Email required for email/social auth
  if (['email', 'google', 'facebook'].includes(data.authProvider) && !data.email) {
    return false;
  }
  // Phone required for phone auth
  if (data.authProvider === 'phone' && !data.phone) {
    return false;
  }
  // Password required for email auth
  if (data.authProvider === 'email' && !data.password) {
    return false;
  }
  return true;
}, {
  message: "Invalid auth provider configuration"
});

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  avatarUrl: z.string().url().optional(),
  newsletterSubscribed: z.boolean().optional(),
  preferredLanguage: z.string().min(2).max(5).optional(),
}).strict();

export const CreateAddressSchema = z.object({
  type: z.enum(['BILLING', 'SHIPPING']),
  streetAddress: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2),
  isDefault: z.boolean().default(false),
});

export type CreateUserData = z.infer<typeof CreateUserSchema>;
export type UpdateUserData = z.infer<typeof UpdateUserSchema>;
export type CreateAddressData = z.infer<typeof CreateAddressSchema>;

// User with addresses type
export type UserWithAddresses = User & {
  addresses: Address[];
};

export class UserModel {
  /**
   * Create a new user with validation and password hashing
   */
  static async create(data: CreateUserData): Promise<UserWithAddresses> {
    const validatedData = CreateUserSchema.parse(data);
    
    // Check for existing user
    if (validatedData.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });
      if (existingUser) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }
    }

    if (validatedData.phone) {
      const existingUser = await prisma.user.findUnique({
        where: { phone: validatedData.phone }
      });
      if (existingUser) {
        throw new Error('PHONE_ALREADY_EXISTS');
      }
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (validatedData.password) {
      passwordHash = await bcrypt.hash(validatedData.password, 12);
    }

    // Determine verification status
    const emailVerified = validatedData.authProvider !== 'email';
    const phoneVerified = validatedData.authProvider === 'phone';

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        phone: validatedData.phone,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        avatarUrl: validatedData.avatarUrl,
        emailVerified,
        phoneVerified,
        authProviders: [validatedData.authProvider],
        lastLogin: new Date(),
      },
      include: {
        addresses: true,
      },
    });

    return user;
  }

  /**
   * Find user by email or phone
   */
  static async findByCredential(credential: string): Promise<UserWithAddresses | null> {
    const isEmail = credential.includes('@');
    const whereClause = isEmail ? { email: credential } : { phone: credential };

    return await prisma.user.findUnique({
      where: whereClause,
      include: {
        addresses: true,
      },
    });
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<UserWithAddresses | null> {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
      },
    });
  }

  /**
   * Verify password
   */
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) {
      return false;
    }
    return await bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Update user profile
   */
  static async update(id: string, data: UpdateUserData): Promise<UserWithAddresses> {
    const validatedData = UpdateUserSchema.parse(data);

    // Check for email conflicts
    if (validatedData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          NOT: { id }
        }
      });
      if (existingUser) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }
    }

    // Check for phone conflicts
    if (validatedData.phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          phone: validatedData.phone,
          NOT: { id }
        }
      });
      if (existingUser) {
        throw new Error('PHONE_ALREADY_EXISTS');
      }
    }

    return await prisma.user.update({
      where: { id },
      data: validatedData,
      include: {
        addresses: true,
      },
    });
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  /**
   * Add auth provider to user
   */
  static async addAuthProvider(id: string, provider: string): Promise<UserWithAddresses> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const updatedProviders = [...new Set([...user.authProviders, provider])];

    return await prisma.user.update({
      where: { id },
      data: { authProviders: updatedProviders },
      include: {
        addresses: true,
      },
    });
  }

  /**
   * Soft delete user
   */
  static async delete(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { status: UserStatus.DELETED },
    });
  }
}

export class AddressModel {
  /**
   * Create address for user
   */
  static async create(userId: string, data: CreateAddressData): Promise<Address> {
    const validatedData = CreateAddressSchema.parse(data);

    return await prisma.$transaction(async (tx) => {
      // If this is set as default, unset other defaults of same type
      if (validatedData.isDefault) {
        await tx.address.updateMany({
          where: {
            userId,
            type: validatedData.type,
          },
          data: {
            isDefault: false,
          },
        });
      }

      return await tx.address.create({
        data: {
          ...validatedData,
          userId,
        },
      });
    });
  }

  /**
   * Update address
   */
  static async update(
    id: string, 
    userId: string, 
    data: Partial<CreateAddressData>
  ): Promise<Address> {
    // Verify ownership
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existingAddress) {
      throw new Error('ADDRESS_NOT_FOUND');
    }

    return await prisma.$transaction(async (tx) => {
      // If setting as default, unset other defaults of same type
      if (data.isDefault && data.type) {
        await tx.address.updateMany({
          where: {
            userId,
            type: data.type,
            NOT: { id },
          },
          data: {
            isDefault: false,
          },
        });
      }

      return await tx.address.update({
        where: { id },
        data,
      });
    });
  }

  /**
   * Delete address
   */
  static async delete(id: string, userId: string): Promise<void> {
    const address = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new Error('ADDRESS_NOT_FOUND');
    }

    await prisma.address.delete({
      where: { id },
    });
  }

  /**
   * Get user's addresses
   */
  static async findByUser(userId: string): Promise<Address[]> {
    return await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get default address by type
   */
  static async findDefaultByType(
    userId: string, 
    type: AddressType
  ): Promise<Address | null> {
    return await prisma.address.findFirst({
      where: {
        userId,
        type,
        isDefault: true,
      },
    });
  }
}

// Helper functions for authentication
export class AuthHelper {
  /**
   * Validate social auth token (mock implementation)
   */
  static async validateSocialToken(
    provider: string, 
    token: string
  ): Promise<{ email: string; firstName: string; lastName: string; avatarUrl?: string }> {
    // Mock implementation - in real app, validate with provider APIs
    if (token.startsWith('mock_')) {
      return {
        email: `${provider}@example.com`,
        firstName: provider.charAt(0).toUpperCase() + provider.slice(1),
        lastName: 'User',
        avatarUrl: `https://example.com/avatar/${provider}.jpg`,
      };
    }
    throw new Error('INVALID_SOCIAL_TOKEN');
  }

  /**
   * Validate phone verification code (mock implementation)
   */
  static async validatePhoneCode(phone: string, code: string): Promise<boolean> {
    // Mock implementation - in real app, validate with SMS service
    return code === '123456';
  }

  /**
   * Send phone verification code (mock implementation)
   */
  static async sendPhoneVerificationCode(phone: string): Promise<void> {
    // Mock implementation - in real app, send SMS via Twilio etc.
    console.log(`Sending verification code to ${phone}: 123456`);
  }

  /**
   * Generate user preferences with defaults
   */
  static getDefaultPreferences() {
    return {
      newsletterSubscribed: false,
      preferredLanguage: 'en',
    };
  }
}

export { prisma };
export default UserModel;