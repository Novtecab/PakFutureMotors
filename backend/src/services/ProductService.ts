// backend/src/services/ProductService.ts
import { Product, ProductCategory, ProductStatus } from '@prisma/client';
import { ProductModel, CreateProductData, UpdateProductData, ProductFilters, PaginatedProducts } from '../models/Product';

export class ProductService {
  /**
   * Creates a new product.
   * @param data - The product data.
   * @returns The created product.
   */
  static async createProduct(data: CreateProductData): Promise<Product> {
    return ProductModel.create(data);
  }

  /**
   * Retrieves a product by its ID.
   * @param productId - The ID of the product.
   * @returns The product or null if not found.
   */
  static async getProductById(productId: string): Promise<Product | null> {
    return ProductModel.findById(productId);
  }

  /**
   * Retrieves a product by its SKU.
   * @param sku - The SKU of the product.
   * @returns The product or null if not found.
   */
  static async getProductBySku(sku: string): Promise<Product | null> {
    return ProductModel.findBySku(sku);
  }

  /**
   * Retrieves a product by its slug.
   * @param slug - The slug of the product.
   * @returns The product or null if not found.
   */
  static async getProductBySlug(slug: string): Promise<Product | null> {
    return ProductModel.findBySlug(slug);
  }

  /**
   * Retrieves a list of products with optional filters, pagination, and sorting.
   * @param filters - Filters to apply.
   * @param page - Current page number.
   * @param limit - Number of items per page.
   * @param sort - Sorting criteria (e.g., 'price_asc', 'createdAt_desc').
   * @returns Paginated list of products.
   */
  static async getProducts(
    filters: ProductFilters = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'createdAt_desc'
  ): Promise<PaginatedProducts> {
    return ProductModel.findMany(filters, page, limit, sort);
  }

  /**
   * Updates an existing product.
   * @param productId - The ID of the product to update.
   * @param data - The update data.
   * @returns The updated product.
   */
  static async updateProduct(productId: string, data: UpdateProductData): Promise<Product> {
    return ProductModel.update(productId, data);
  }

  /**
   * Deletes a product (soft delete by changing status to DISCONTINUED).
   * @param productId - The ID of the product to delete.
   */
  static async deleteProduct(productId: string): Promise<void> {
    await ProductModel.delete(productId);
  }

  /**
   * Updates the inventory of a product.
   * @param productId - The ID of the product.
   * @param quantity - The quantity to add, subtract, or set.
   * @param operation - 'increment', 'decrement', or 'set'.
   * @returns The updated product.
   */
  static async updateProductInventory(
    productId: string,
    quantity: number,
    operation: 'increment' | 'decrement' | 'set' = 'set'
  ): Promise<Product> {
    return ProductModel.updateInventory(productId, quantity, operation);
  }

  /**
   * Checks if a product is in stock for a given quantity.
   * @param productId - The ID of the product.
   * @param requestedQuantity - The quantity to check.
   * @returns True if in stock, false otherwise.
   */
  static async isProductInStock(productId: string, requestedQuantity: number = 1): Promise<boolean> {
    return ProductModel.checkStock(productId, requestedQuantity);
  }

  /**
   * Retrieves related products based on category, brand, or tags.
   * @param productId - The ID of the product to find related items for.
   * @param limit - Maximum number of related products to return.
   * @returns A list of related products.
   */
  static async getRelatedProducts(productId: string, limit: number = 4): Promise<Product[]> {
    return ProductModel.getRelatedProducts(productId, limit);
  }

  /**
   * Retrieves search suggestions based on a query.
   * @param query - The search query.
   * @param limit - Maximum number of suggestions to return.
   * @returns An object containing suggested products, categories, and brands.
   */
  static async getSearchSuggestions(query: string, limit: number = 5) {
    return ProductModel.getSearchSuggestions(query, limit);
  }
}