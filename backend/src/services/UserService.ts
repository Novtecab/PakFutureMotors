// backend/src/services/UserService.ts
import { User, Address, UserStatus, AddressType } from '@prisma/client';
import { UserModel, AddressModel, UpdateUserData, CreateAddressData } from '../models/User';

export class UserService {
  /**
   * Retrieves a user's profile by ID.
   * @param userId - The ID of the user.
   * @returns The user profile with addresses.
   */
  static async getUserProfile(userId: string): Promise<User | null> {
    return UserModel.findById(userId);
  }

  /**
   * Updates a user's profile.
   * @param userId - The ID of the user.
   * @param data - The update data.
   * @returns The updated user profile with addresses.
   */
  static async updateUserProfile(userId: string, data: UpdateUserData): Promise<User> {
    return UserModel.update(userId, data);
  }

  /**
   * Retrieves all addresses for a user.
   * @param userId - The ID of the user.
   * @returns A list of addresses.
   */
  static async getUserAddresses(userId: string): Promise<Address[]> {
    return AddressModel.findByUser(userId);
  }

  /**
   * Adds a new address for a user.
   * @param userId - The ID of the user.
   * @param data - The address data.
   * @returns The newly created address.
   */
  static async addAddress(userId: string, data: CreateAddressData): Promise<Address> {
    return AddressModel.create(userId, data);
  }

  /**
   * Updates an existing address for a user.
   * @param addressId - The ID of the address to update.
   * @param userId - The ID of the user who owns the address.
   * @param data - The update data.
   * @returns The updated address.
   */
  static async updateAddress(addressId: string, userId: string, data: Partial<CreateAddressData>): Promise<Address> {
    return AddressModel.update(addressId, userId, data);
  }

  /**
   * Deletes an address for a user.
   * @param addressId - The ID of the address to delete.
   * @param userId - The ID of the user who owns the address.
   */
  static async deleteAddress(addressId: string, userId: string): Promise<void> {
    await AddressModel.delete(addressId, userId);
  }

  /**
   * Sets a specific address as the default for a user and address type.
   * @param addressId - The ID of the address to set as default.
   * @param userId - The ID of the user.
   * @param type - The type of address (BILLING or SHIPPING).
   * @returns The updated default address.
   */
  static async setDefaultAddress(addressId: string, userId: string, type: AddressType): Promise<Address> {
    // First, unset any existing default of the same type
    const currentDefault = await AddressModel.findDefaultByType(userId, type);
    if (currentDefault && currentDefault.id !== addressId) {
      await AddressModel.update(currentDefault.id, userId, { isDefault: false });
    }

    // Then, set the specified address as default
    return AddressModel.update(addressId, userId, { isDefault: true, type });
  }
}