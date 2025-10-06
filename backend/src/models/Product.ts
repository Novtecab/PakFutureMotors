/**
 * T020: Product model and catalog
 * Product entity with categories, inventory tracking, media management
 */
import { PrismaClient, Product, ProductImage, ProductDocument, ProductCategory, ProductStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(50).regex(/^[A-Z0-9\-]+$/),
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.nativeEnum(ProductCategory),
  subcategory: z.string().max(100).optional(),
  price: z.number().positive().multipleOf(0.01),
  currency: z.string().length(3).default('USD'),
  salePrice: z.number().positive().multipleOf(0.01).optional(),
  stockQuantity: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  trackInventory: z.boolean().default(true),
  brand: z.string().min(1).max(100),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  specifications: z.record(z.any()).optional(),
  tags: z.array(z.string()).default([]),
  searchKeywords: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.ACTIVE),
});

export const UpdateProductSchema = CreateProductSchema.partial().omit({ sku: true });

export const ProductFilterSchema = z.object({
  category: z.nativeEnum(ProductCategory).optional(),
  brand: z.string().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  featured: z.boolean().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  inStock: z.boolean().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const CreateProductImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
});

export const CreateProductDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  type: z.string().min(1).max(50),
});

export type CreateProductData = z.infer<typeof CreateProductSchema>;
export type UpdateProductData = z.infer<typeof UpdateProductSchema>;
export type ProductFilters = z.infer<typeof ProductFilterSchema>;
export type CreateProductImageData = z.infer<typeof CreateProductImageSchema>;
export type CreateProductDocumentData = z.infer<typeof CreateProductDocumentSchema>;

// Product with related data
export type ProductWithMedia = Product & {
  images: ProductImage[];
  documents: ProductDocument[];
};

export interface PaginatedProducts {
  products: ProductWithMedia[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    categories: ProductCategory[];
    brands: string[];
    priceRange: { min: number; max: number };
  };
}

export class ProductModel {
  /**
   * Create a new product
   */
  static async create(data: CreateProductData): Promise<ProductWithMedia> {
    const validatedData = CreateProductSchema.parse(data);

    // Check for duplicate SKU
    const existingProduct = await prisma.product.findUnique({
      where: { sku: validatedData.sku }
    });

    if (existingProduct) {
      throw new Error('SKU_ALREADY_EXISTS');
    }

    // Generate slug from name
    const slug = this.generateSlug(validatedData.name);

    // Ensure slug is unique
    const uniqueSlug = await this.ensureUniqueSlug(slug);

    const product = await prisma.product.create({
      data: {
        ...validatedData,
        slug: uniqueSlug,
        specifications: validatedData.specifications || {},
      },
      include: {
        images: true,
        documents: true,
      },
    });

    return product;
  }

  /**
   * Find product by ID
   */
  static async findById(id: string): Promise<ProductWithMedia | null> {
    return await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        documents: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * Find product by SKU
   */
  static async findBySku(sku: string): Promise<ProductWithMedia | null> {
    return await prisma.product.findUnique({
      where: { sku },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        documents: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * Find product by slug
   */
  static async findBySlug(slug: string): Promise<ProductWithMedia | null> {
    return await prisma.product.findUnique({
      where: { slug },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        documents: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * Find products with filters and pagination
   */
  static async findMany(
    filters: ProductFilters = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'createdAt_desc'
  ): Promise<PaginatedProducts> {
    const validatedFilters = ProductFilterSchema.parse(filters);
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      status: validatedFilters.status || ProductStatus.ACTIVE,
    };

    if (validatedFilters.category) {
      whereClause.category = validatedFilters.category;
    }

    if (validatedFilters.brand) {
      whereClause.brand = validatedFilters.brand;
    }

    if (validatedFilters.minPrice || validatedFilters.maxPrice) {
      whereClause.price = {};
      if (validatedFilters.minPrice) {
        whereClause.price.gte = validatedFilters.minPrice;
      }
      if (validatedFilters.maxPrice) {
        whereClause.price.lte = validatedFilters.maxPrice;
      }
    }

    if (validatedFilters.featured !== undefined) {
      whereClause.featured = validatedFilters.featured;
    }

    if (validatedFilters.inStock) {
      whereClause.stockQuantity = { gt: 0 };
    }

    if (validatedFilters.search) {
      const searchTerm = validatedFilters.search.toLowerCase();
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
        { model: { contains: searchTerm, mode: 'insensitive' } },
        { searchKeywords: { hasSome: [searchTerm] } },
        { tags: { hasSome: [searchTerm] } },
      ];
    }

    if (validatedFilters.tags && validatedFilters.tags.length > 0) {
      whereClause.tags = { hasSome: validatedFilters.tags };
    }

    // Build order clause
    const [sortField, sortDirection] = sort.split('_');
    const orderBy: any = {};
    
    switch (sortField) {
      case 'price':
        orderBy.price = sortDirection === 'desc' ? 'desc' : 'asc';
        break;
      case 'name':
        orderBy.name = sortDirection === 'desc' ? 'desc' : 'asc';
        break;
      case 'createdAt':
      default:
        orderBy.createdAt = sortDirection === 'desc' ? 'desc' : 'asc';
        break;
    }

    // Execute queries
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
            take: 1, // Only primary image for listing
          },
          documents: false,
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    // Get filter data for UI
    const [categories, brands, priceRange] = await Promise.all([
      this.getAvailableCategories(),
      this.getAvailableBrands(),
      this.getPriceRange(),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        categories,
        brands,
        priceRange,
      },
    };
  }

  /**
   * Update product
   */
  static async update(id: string, data: UpdateProductData): Promise<ProductWithMedia> {
    const validatedData = UpdateProductSchema.parse(data);

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    // Update slug if name changed
    let updateData: any = { ...validatedData };
    if (validatedData.name && validatedData.name !== existingProduct.name) {
      const newSlug = this.generateSlug(validatedData.name);
      updateData.slug = await this.ensureUniqueSlug(newSlug, id);
    }

    return await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        documents: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * Delete product (soft delete)
   */
  static async delete(id: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    await prisma.product.update({
      where: { id },
      data: { status: ProductStatus.DISCONTINUED },
    });
  }

  /**
   * Update inventory
   */
  static async updateInventory(
    id: string, 
    quantity: number, 
    operation: 'increment' | 'decrement' | 'set' = 'set'
  ): Promise<Product> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    if (!product.trackInventory) {
      throw new Error('INVENTORY_NOT_TRACKED');
    }

    let newQuantity: number;
    
    switch (operation) {
      case 'increment':
        newQuantity = product.stockQuantity + quantity;
        break;
      case 'decrement':
        newQuantity = Math.max(0, product.stockQuantity - quantity);
        break;
      case 'set':
      default:
        newQuantity = Math.max(0, quantity);
        break;
    }

    return await prisma.product.update({
      where: { id },
      data: { stockQuantity: newQuantity },
    });
  }

  /**
   * Check if product is in stock
   */
  static async checkStock(id: string, requestedQuantity: number = 1): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { stockQuantity: true, trackInventory: true },
    });

    if (!product) {
      return false;
    }

    if (!product.trackInventory) {
      return true; // Always available if not tracking inventory
    }

    return product.stockQuantity >= requestedQuantity;
  }

  /**
   * Get related products
   */
  static async getRelatedProducts(
    productId: string, 
    limit: number = 4
  ): Promise<ProductWithMedia[]> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { category: true, brand: true, tags: true },
    });

    if (!product) {
      return [];
    }

    return await prisma.product.findMany({
      where: {
        id: { not: productId },
        status: ProductStatus.ACTIVE,
        OR: [
          { category: product.category },
          { brand: product.brand },
          { tags: { hasSome: product.tags } },
        ],
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
        documents: false,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Search suggestions
   */
  static async getSearchSuggestions(query: string, limit: number = 5) {
    const searchTerm = query.toLowerCase();

    const [products, categories, brands] = await Promise.all([
      prisma.product.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { searchKeywords: { hasSome: [searchTerm] } },
          ],
        },
        select: { id: true, name: true, price: true },
        take: limit,
      }),
      this.getMatchingCategories(searchTerm),
      this.getMatchingBrands(searchTerm, limit),
    ]);

    return {
      products,
      categories,
      brands,
    };
  }

  // Helper methods
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private static async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await prisma.product.findFirst({
        where: {
          slug,
          ...(excludeId && { id: { not: excludeId } }),
        },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  private static async getAvailableCategories(): Promise<ProductCategory[]> {
    const categories = await prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: { category: true },
      distinct: ['category'],
    });

    return categories.map(c => c.category);
  }

  private static async getAvailableBrands(): Promise<string[]> {
    const brands = await prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    });

    return brands.map(b => b.brand);
  }

  private static async getPriceRange(): Promise<{ min: number; max: number }> {
    const result = await prisma.product.aggregate({
      where: { status: ProductStatus.ACTIVE },
      _min: { price: true },
      _max: { price: true },
    });

    return {
      min: Number(result._min.price) || 0,
      max: Number(result._max.price) || 0,
    };
  }

  private static async getMatchingCategories(searchTerm: string): Promise<string[]> {
    return Object.values(ProductCategory).filter(category =>
      category.toLowerCase().includes(searchTerm)
    );
  }

  private static async getMatchingBrands(searchTerm: string, limit: number): Promise<string[]> {
    const brands = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        brand: { contains: searchTerm, mode: 'insensitive' },
      },
      select: { brand: true },
      distinct: ['brand'],
      take: limit,
    });

    return brands.map(b => b.brand);
  }
}

export class ProductImageModel {
  /**
   * Add image to product
   */
  static async create(productId: string, data: CreateProductImageData): Promise<ProductImage> {
    const validatedData = CreateProductImageSchema.parse(data);

    return await prisma.$transaction(async (tx) => {
      // If setting as primary, unset other primary images
      if (validatedData.isPrimary) {
        await tx.productImage.updateMany({
          where: { productId },
          data: { isPrimary: false },
        });
      }

      return await tx.productImage.create({
        data: {
          ...validatedData,
          productId,
        },
      });
    });
  }

  /**
   * Update image
   */
  static async update(
    id: string, 
    data: Partial<CreateProductImageData>
  ): Promise<ProductImage> {
    return await prisma.$transaction(async (tx) => {
      const image = await tx.productImage.findUnique({
        where: { id },
      });

      if (!image) {
        throw new Error('IMAGE_NOT_FOUND');
      }

      // If setting as primary, unset other primary images
      if (data.isPrimary) {
        await tx.productImage.updateMany({
          where: { 
            productId: image.productId,
            id: { not: id },
          },
          data: { isPrimary: false },
        });
      }

      return await tx.productImage.update({
        where: { id },
        data,
      });
    });
  }

  /**
   * Delete image
   */
  static async delete(id: string): Promise<void> {
    await prisma.productImage.delete({
      where: { id },
    });
  }
}

export class ProductDocumentModel {
  /**
   * Add document to product
   */
  static async create(productId: string, data: CreateProductDocumentData): Promise<ProductDocument> {
    const validatedData = CreateProductDocumentSchema.parse(data);

    return await prisma.productDocument.create({
      data: {
        ...validatedData,
        productId,
      },
    });
  }

  /**
   * Delete document
   */
  static async delete(id: string): Promise<void> {
    await prisma.productDocument.delete({
      where: { id },
    });
  }
}

export { prisma };
export default ProductModel;