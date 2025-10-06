/**
 * T025: Cart model and session management
 * Cart entity with Redis integration, expiration, guest support
 */
import { PrismaClient, Cart, CartItem, Product } from '@prisma/client';
import { z } from 'zod';
import ProductModel from './Product';

const prisma = new PrismaClient();

// Validation schemas
export const AddToCartSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(100),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(100),
});

export const MergeCartSchema = z.object({
  guestCartId: z.string().cuid(),
});

export type AddToCartData = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemData = z.infer<typeof UpdateCartItemSchema>;
export type MergeCartData = z.infer<typeof MergeCartSchema>;

// Cart with items and products
export type CartWithItems = Cart & {
  items: (CartItem & {
    product: Product;
  })[];
};

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  estimatedTax?: number;
  estimatedShipping?: number;
  estimatedTotal?: number;
}

export class CartModel {
  /**
   * Get or create cart for user or session
   */
  static async getOrCreate(userId?: string, sessionId?: string): Promise<CartWithItems> {
    if (!userId && !sessionId) {
      throw new Error('USER_ID_OR_SESSION_ID_REQUIRED');
    }

    // Try to find existing cart
    let existingCart = await prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    // Create new cart if none exists
    if (!existingCart) {
      existingCart = await prisma.cart.create({
        data: {
          userId,
          sessionId,
          expiresAt: this.calculateExpirationDate(),
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });
    }

    // Update cart with calculated totals
    return await this.updateCartTotals(existingCart);
  }

  /**
   * Add item to cart
   */
  static async addItem(
    cartId: string,
    data: AddToCartData
  ): Promise<CartWithItems> {
    const validatedData = AddToCartSchema.parse(data);

    // Verify product exists and check stock
    const product = await ProductModel.findById(validatedData.productId);
    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    if (product.status !== 'ACTIVE') {
      throw new Error('PRODUCT_NOT_AVAILABLE');
    }

    // Check stock availability
    const isInStock = await ProductModel.checkStock(
      validatedData.productId,
      validatedData.quantity
    );
    if (!isInStock) {
      throw new Error('INSUFFICIENT_STOCK');
    }

    return await prisma.$transaction(async (tx) => {
      // Check if item already exists in cart
      const existingItem = await tx.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId,
            productId: validatedData.productId,
          },
        },
      });

      if (existingItem) {
        // Update quantity
        const newQuantity = existingItem.quantity + validatedData.quantity;
        
        // Check stock for new quantity
        const hasStock = await ProductModel.checkStock(
          validatedData.productId,
          newQuantity
        );
        if (!hasStock) {
          throw new Error('INSUFFICIENT_STOCK');
        }

        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
        });
      } else {
        // Create new cart item
        await tx.cartItem.create({
          data: {
            cartId,
            productId: validatedData.productId,
            quantity: validatedData.quantity,
          },
        });
      }

      // Update cart expiration
      await tx.cart.update({
        where: { id: cartId },
        data: { expiresAt: this.calculateExpirationDate() },
      });

      // Return updated cart
      const updatedCart = await tx.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { addedAt: 'desc' },
          },
        },
      });

      return this.updateCartTotals(updatedCart!);
    });
  }

  /**
   * Update cart item quantity
   */
  static async updateItem(
    itemId: string,
    data: UpdateCartItemData
  ): Promise<CartWithItems> {
    const validatedData = UpdateCartItemSchema.parse(data);

    return await prisma.$transaction(async (tx) => {
      const cartItem = await tx.cartItem.findUnique({
        where: { id: itemId },
        include: { cart: true },
      });

      if (!cartItem) {
        throw new Error('CART_ITEM_NOT_FOUND');
      }

      if (validatedData.quantity === 0) {
        // Remove item from cart
        await tx.cartItem.delete({
          where: { id: itemId },
        });
      } else {
        // Check stock for new quantity
        const hasStock = await ProductModel.checkStock(
          cartItem.productId,
          validatedData.quantity
        );
        if (!hasStock) {
          throw new Error('INSUFFICIENT_STOCK');
        }

        // Update quantity
        await tx.cartItem.update({
          where: { id: itemId },
          data: { quantity: validatedData.quantity },
        });
      }

      // Update cart expiration
      await tx.cart.update({
        where: { id: cartItem.cartId },
        data: { expiresAt: this.calculateExpirationDate() },
      });

      // Return updated cart
      const updatedCart = await tx.cart.findUnique({
        where: { id: cartItem.cartId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { addedAt: 'desc' },
          },
        },
      });

      return this.updateCartTotals(updatedCart!);
    });
  }

  /**
   * Remove item from cart
   */
  static async removeItem(itemId: string): Promise<CartWithItems> {
    return await this.updateItem(itemId, { quantity: 0 });
  }

  /**
   * Clear cart
   */
  static async clear(cartId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { cartId },
      });

      await tx.cart.update({
        where: { id: cartId },
        data: { 
          subtotal: 0,
          expiresAt: this.calculateExpirationDate(),
        },
      });
    });
  }

  /**
   * Merge guest cart with user cart
   */
  static async mergeGuestCart(
    userCartId: string,
    data: MergeCartData
  ): Promise<CartWithItems> {
    const validatedData = MergeCartSchema.parse(data);

    return await prisma.$transaction(async (tx) => {
      // Get guest cart items
      const guestCart = await tx.cart.findUnique({
        where: { id: validatedData.guestCartId },
        include: {
          items: true,
        },
      });

      if (!guestCart) {
        throw new Error('GUEST_CART_NOT_FOUND');
      }

      // Get user cart items
      const userCart = await tx.cart.findUnique({
        where: { id: userCartId },
        include: {
          items: true,
        },
      });

      if (!userCart) {
        throw new Error('USER_CART_NOT_FOUND');
      }

      // Merge items
      for (const guestItem of guestCart.items) {
        const existingUserItem = userCart.items.find(
          item => item.productId === guestItem.productId
        );

        if (existingUserItem) {
          // Combine quantities
          const newQuantity = existingUserItem.quantity + guestItem.quantity;
          
          // Check stock
          const hasStock = await ProductModel.checkStock(
            guestItem.productId,
            newQuantity
          );
          
          if (hasStock) {
            await tx.cartItem.update({
              where: { id: existingUserItem.id },
              data: { quantity: newQuantity },
            });
          }
        } else {
          // Add new item to user cart
          const hasStock = await ProductModel.checkStock(
            guestItem.productId,
            guestItem.quantity
          );
          
          if (hasStock) {
            await tx.cartItem.create({
              data: {
                cartId: userCartId,
                productId: guestItem.productId,
                quantity: guestItem.quantity,
              },
            });
          }
        }
      }

      // Delete guest cart
      await tx.cartItem.deleteMany({
        where: { cartId: validatedData.guestCartId },
      });
      await tx.cart.delete({
        where: { id: validatedData.guestCartId },
      });

      // Update user cart expiration
      await tx.cart.update({
        where: { id: userCartId },
        data: { expiresAt: this.calculateExpirationDate() },
      });

      // Return updated user cart
      const mergedCart = await tx.cart.findUnique({
        where: { id: userCartId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { addedAt: 'desc' },
          },
        },
      });

      return this.updateCartTotals(mergedCart!);
    });
  }

  /**
   * Convert cart to user cart (when guest logs in)
   */
  static async convertToUserCart(cartId: string, userId: string): Promise<CartWithItems> {
    return await prisma.$transaction(async (tx) => {
      // Check if user already has a cart
      const existingUserCart = await tx.cart.findFirst({
        where: { userId },
        include: {
          items: true,
        },
      });

      if (existingUserCart) {
        // Merge guest cart with existing user cart
        return await this.mergeGuestCart(existingUserCart.id, { guestCartId: cartId });
      } else {
        // Convert guest cart to user cart
        const updatedCart = await tx.cart.update({
          where: { id: cartId },
          data: { 
            userId,
            sessionId: null,
            expiresAt: this.calculateExpirationDate(),
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: {
                      where: { isPrimary: true },
                      take: 1,
                    },
                  },
                },
              },
              orderBy: { addedAt: 'desc' },
            },
          },
        });

        return this.updateCartTotals(updatedCart);
      }
    });
  }

  /**
   * Get cart summary
   */
  static async getSummary(cartId: string): Promise<CartSummary> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      throw new Error('CART_NOT_FOUND');
    }

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.items.reduce(
      (sum, item) => sum + (Number(item.product.price) * item.quantity),
      0
    );

    return {
      itemCount,
      subtotal,
      // Tax and shipping would be calculated based on address/items
      estimatedTax: subtotal * 0.08, // 8% tax estimate
      estimatedShipping: this.calculateShipping(cart.items),
      estimatedTotal: subtotal + (subtotal * 0.08) + this.calculateShipping(cart.items),
    };
  }

  /**
   * Cleanup expired carts
   */
  static async cleanupExpiredCarts(): Promise<number> {
    const result = await prisma.$transaction(async (tx) => {
      // Delete expired cart items first
      await tx.cartItem.deleteMany({
        where: {
          cart: {
            expiresAt: {
              lt: new Date(),
            },
          },
        },
      });

      // Delete expired carts
      const deleteResult = await tx.cart.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return deleteResult.count;
    });

    return result;
  }

  // Helper methods
  private static calculateExpirationDate(): Date {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 30); // 30 days from now
    return expiration;
  }

  private static async updateCartTotals(cart: CartWithItems): Promise<CartWithItems> {
    const subtotal = cart.items.reduce(
      (sum, item) => sum + (Number(item.product.price) * item.quantity),
      0
    );

    await prisma.cart.update({
      where: { id: cart.id },
      data: { subtotal },
    });

    return {
      ...cart,
      subtotal,
    };
  }

  private static calculateShipping(items: any[]): number {
    // Simple shipping calculation - would be more complex in real app
    const totalWeight = items.reduce((sum, item) => {
      // Assume weight based on category
      const weight = item.product.category === 'CARS' ? 2000 : 5; // kg
      return sum + (weight * item.quantity);
    }, 0);

    if (totalWeight > 1000) return 0; // Free shipping for heavy items (cars)
    if (totalWeight > 10) return 25; // Standard shipping
    return 10; // Light package shipping
  }

  /**
   * Validate cart before checkout
   */
  static async validateForCheckout(cartId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      return { valid: false, errors: ['CART_NOT_FOUND'] };
    }

    const errors: string[] = [];

    if (cart.items.length === 0) {
      errors.push('CART_EMPTY');
    }

    // Check stock for all items
    for (const item of cart.items) {
      const hasStock = await ProductModel.checkStock(
        item.productId,
        item.quantity
      );
      if (!hasStock) {
        errors.push(`INSUFFICIENT_STOCK_${item.product.name}`);
      }

      if (item.product.status !== 'ACTIVE') {
        errors.push(`PRODUCT_NOT_AVAILABLE_${item.product.name}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export { prisma };
export default CartModel;