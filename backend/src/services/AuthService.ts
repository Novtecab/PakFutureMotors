// backend/src/services/AuthService.ts
import { User, UserStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { UserModel, AuthHelper, CreateUserData, prisma } from '../models/User'; // Import prisma
import { z } from 'zod';

// Define JWT payload structure
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN'; // Assuming roles for now, can be expanded
}

// Zod schema for login input
export const LoginSchema = z.object({
  credential: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey';
  private static readonly ACCESS_TOKEN_EXPIRATION = '15m'; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRATION = '7d'; // 7 days

  /**
   * Registers a new user.
   * @param data - User registration data.
   * @returns The newly created user.
   */
  static async register(data: CreateUserData): Promise<User> {
    // Password hashing and user creation is handled by UserModel.create
    const user = await UserModel.create(data);
    return user;
  }

  /**
   * Logs in a user with email/password or phone/OTP.
   * @param input - Login credentials.
   * @returns User and JWT tokens.
   */
  static async login(input: LoginInput): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const validatedInput = LoginSchema.parse(input);

    const user = await UserModel.findByCredential(validatedInput.credential);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // For email/password authentication
    if (user.passwordHash) {
      const isPasswordValid = await UserModel.verifyPassword(user, validatedInput.password);
      if (!isPasswordValid) {
        throw new Error('INVALID_CREDENTIALS');
      }
    } else {
      // Handle social login or phone/OTP where passwordHash might be null
      // For simplicity, assuming if passwordHash is null, it's a social/OTP user
      // A real implementation would require specific social token validation or OTP verification here
      throw new Error('PASSWORD_REQUIRED_FOR_THIS_ACCOUNT');
    }

    await UserModel.updateLastLogin(user.id);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  /**
   * Refreshes an access token using a refresh token.
   * @param refreshToken - The refresh token.
   * @returns New access token and refresh token.
   */
  static async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as JwtPayload;
      const user = await UserModel.findById(decoded.userId);

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }

      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user); // Rotate refresh token

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }
  }

  /**
   * Generates a new access token.
   * @param user - The user object.
   * @returns The access token.
   */
  static generateAccessToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email || '', // Email might be null for phone-only users
      role: 'USER', // Default role, can be dynamic
    };
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.ACCESS_TOKEN_EXPIRATION });
  }

  /**
   * Generates a new refresh token.
   * @param user - The user object.
   * @returns The refresh token.
   */
  static generateRefreshToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email || '',
      role: 'USER',
    };
    return jwt.sign(payload, this.JWT_REFRESH_SECRET, { expiresIn: this.REFRESH_TOKEN_EXPIRATION });
  }

  /**
   * Verifies an access token.
   * @param token - The access token.
   * @returns The decoded JWT payload.
   */
  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JwtPayload;
    } catch (error) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
  }

  /**
   * Initiates phone number verification by sending an OTP.
   * @param phone - The phone number to verify.
   */
  static async initiatePhoneVerification(phone: string): Promise<void> {
    // In a real application, this would integrate with an SMS service like Twilio
    // For now, we'll use a mock helper.
    await AuthHelper.sendPhoneVerificationCode(phone);
  }

  /**
   * Verifies a phone number using an OTP.
   * @param phone - The phone number.
   * @param code - The OTP.
   * @returns True if verification is successful, false otherwise.
   */
  static async verifyPhoneNumber(phone: string, code: string): Promise<boolean> {
    // In a real application, this would integrate with an SMS service like Twilio
    // For now, we'll use a mock helper.
    const isValid = await AuthHelper.validatePhoneCode(phone, code);
    if (isValid) {
      // Update user's phoneVerified status in the database
      const user = await UserModel.findByCredential(phone);
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { phoneVerified: true },
        });
      }
    }
    return isValid;
  }
}