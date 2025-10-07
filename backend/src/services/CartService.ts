// backend/src/services/CartService.ts
import { Cart, CartItem, Product } from '@prisma/client';
import { CartModel, AddToCartData, UpdateCartItemData, CartWithItems, CartSummary } from '../models/Cart';

export class CartService {
  /**
   * Retrieves or creates a shopping cart for a user or session.
   * @param userId - The ID of the user (optional).
   * @param sessionId - The ID of the session (optional).
   * @returns The cart with its items.
   */
  static async getOrCreateCart(userId?: string, sessionId?: string): Promise<CartWithItems> {
    return CartModel.getOrCreate(userId, sessionId);
  }

  /**
   * Adds an item to the specified cart.
   * @param cartId - The ID of the cart.
   * @param data - The item data to add.
   * @returns The updated cart with its items.
   */
  static async addItemToCart(cartId: string, data: AddToCartData): Promise<CartWithItems> {
    return CartModel.addItem(cartId, data);
  }

  /**
   * Updates the quantity of an item in the cart.
   * If quantity is 0, the item is removed.
   * @param itemId - The ID of the cart item.
   * @param data - The update data (quantity).
   * @returns The updated cart with its items.
   */
  static async updateCartItemQuantity(itemId: string, data: UpdateCartItemData): Promise<CartWithItems> {
    return CartModel.updateItem(itemId, data);
  }

  /**
   * Removes an item from the cart.
   * @param itemId - The ID of the cart item to remove.
   * @returns The updated cart with its items.
   */
  static async removeCartItem(itemId: string): Promise<CartWithItems> {
    return CartModel.removeItem(itemId);
  }

  /**
   * Clears all items from the specified cart.
   * @param cartId - The ID of the cart to clear.
   */
  static async clearCart(cartId: string): Promise<void> {
    await CartModel.clear(cartId);
  }

  /**
   * Merges a guest cart into a user's cart.
   * @param userCartId - The ID of the user's cart.
   * @param guestCartId - The ID of the guest cart to merge.
   * @returns The merged user cart.
   */
  static async mergeCarts(userCartId: string, guestCartId: string): Promise<CartWithItems> {
    return CartModel.mergeGuestCart(userCartId, { guestCartId });
  }

  /**
   * Converts a guest cart to a user cart when a guest logs in.
   * @param cartId - The ID of the guest cart.
   * @param userId - The ID of the user.
   * @returns The converted user cart.
   */
  static async convertGuestCartToUserCart(cartId: string, userId: string): Promise<CartWithItems> {
    return CartModel.convertToUserCart(cartId, userId);
  }

  /**
   * Retrieves a summary of the cart, including item count and total price.
   * @param cartId - The ID of the cart.
   * @returns The cart summary.
   */
  static async getCartSummary(cartId: string): Promise<CartSummary> {
    return CartModel.getSummary(cartId);
  }

  /**
   * Validates the cart for checkout, checking stock and product availability.
   * @param cartId - The ID of the cart.
   * @returns An object indicating validity and a list of errors if any.
   */
  static async validateCartForCheckout(cartId: string): Promise<{ valid: boolean; errors: string[] }> {
    return CartModel.validateForCheckout(cartId);
  }

  /**
   * Cleans up expired carts from the database.
   * @returns The number of expired carts deleted.
   */
  static async cleanupExpiredCarts(): Promise<number> {
    return CartModel.cleanupExpiredCarts();
  }
}