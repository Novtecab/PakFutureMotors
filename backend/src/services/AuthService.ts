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
  credential: z.string().optional(), // Email or phone
  password: z.string().optional(),
  authProvider: z.enum(['email', 'google', 'facebook', 'phone']),
  socialToken: z.string().optional(), // For social logins
  verificationCode: z.string().optional(), // For phone/OTP
}).refine((data) => {
  if (data.authProvider === 'email') {
    return data.credential && data.password;
  }
  if (data.authProvider === 'phone') {
    return data.credential && data.verificationCode;
  }
  if (['google', 'facebook'].includes(data.authProvider)) {
    return data.socialToken;
  }
  return false;
}, {
  message: "Invalid login credentials for the specified auth provider",
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
    let user: User | null = null;

    switch (validatedInput.authProvider) {
      case 'email':
        if (!validatedInput.credential || !validatedInput.password) {
          throw new Error('EMAIL_AND_PASSWORD_REQUIRED');
        }
        user = await UserModel.findByCredential(validatedInput.credential);
        if (!user || user.status !== UserStatus.ACTIVE) {
          throw new Error('INVALID_CREDENTIALS');
        }
        if (!user.passwordHash || !(await UserModel.verifyPassword(user, validatedInput.password))) {
          throw new Error('INVALID_CREDENTIALS');
        }
        break;

      case 'phone':
        if (!validatedInput.credential || !validatedInput.verificationCode) {
          throw new Error('PHONE_AND_VERIFICATION_CODE_REQUIRED');
        }
        const isPhoneVerified = await AuthHelper.validatePhoneCode(validatedInput.credential, validatedInput.verificationCode);
        if (!isPhoneVerified) {
          throw new Error('INVALID_VERIFICATION_CODE');
        }
        user = await UserModel.findByCredential(validatedInput.credential);
        if (!user || user.status !== UserStatus.ACTIVE) {
          throw new Error('USER_NOT_FOUND_OR_INACTIVE');
        }
        // Ensure phone is marked as verified in DB if not already
        if (!user.phoneVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { phoneVerified: true },
          });
          user.phoneVerified = true; // Update in memory object
        }
        break;

      case 'google':
      case 'facebook':
        if (!validatedInput.socialToken) {
          throw new Error('SOCIAL_TOKEN_REQUIRED');
        }
        const socialProfile = await AuthHelper.validateSocialToken(validatedInput.authProvider, validatedInput.socialToken);
        if (!socialProfile.email) {
          throw new Error('SOCIAL_LOGIN_EMAIL_MISSING');
        }
        user = await UserModel.findByCredential(socialProfile.email);

        if (!user) {
          // Register new user if not found
          user = await UserModel.create({
            email: socialProfile.email,
            firstName: socialProfile.firstName,
            lastName: socialProfile.lastName,
            avatarUrl: socialProfile.avatarUrl,
            authProvider: validatedInput.authProvider,
          });
          // For social logins, email is considered verified upon successful token validation
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true },
          });
          user.emailVerified = true; // Update the in-memory user object
        } else if (user.status !== UserStatus.ACTIVE) {
          throw new Error('USER_ACCOUNT_INACTIVE');
        } else {
          // Ensure social provider is added if not already
          if (!user.authProviders.includes(validatedInput.authProvider)) {
            user = await UserModel.addAuthProvider(user.id, validatedInput.authProvider);
          }
        }
        break;

      default:
        throw new Error('UNSUPPORTED_AUTH_PROVIDER');
    }

    if (!user) {
      throw new Error('LOGIN_FAILED');
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