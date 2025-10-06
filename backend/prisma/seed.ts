/**
 * T026: Database migrations and seeding
 * Initial migration, seed data for products, services, test users
 */
import { PrismaClient } from '@prisma/client';
import UserModel from '../src/models/User';
import ProductModel from '../src/models/Product';
import ServiceModel from '../src/models/Service';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  console.log('👤 Creating admin user...');
  const adminUser = await UserModel.create({
    email: 'admin@pakfuturemotors.com',
    password: 'AdminPass123!',
    firstName: 'Admin',
    lastName: 'User',
    authProvider: 'email',
  });

  // Create test users
  console.log('👥 Creating test users...');
  const testUser1 = await UserModel.create({
    email: 'customer@example.com',
    password: 'CustomerPass123!',
    firstName: 'John',
    lastName: 'Doe',
    authProvider: 'email',
  });

  const testUser2 = await UserModel.create({
    phone: '+1234567890',
    firstName: 'Jane',
    lastName: 'Smith',
    authProvider: 'phone',
  });

  const testUser3 = await UserModel.create({
    email: 'google.user@example.com',
    firstName: 'Google',
    lastName: 'User',
    authProvider: 'google',
  });

  // Create sample products - Cars
  console.log('🚗 Creating car products...');
  const teslaModelS = await ProductModel.create({
    sku: 'CAR-TESLA-MS-001',
    name: 'Tesla Model S Plaid',
    description: 'The quickest accelerating sedan ever built, with a top speed of 200 mph and 405 miles of range.',
    category: 'CARS',
    price: 129990.00,
    stockQuantity: 5,
    brand: 'Tesla',
    model: 'Model S',
    year: 2024,
    specifications: {
      acceleration: '1.99s 0-60 mph',
      topSpeed: '200 mph',
      range: '405 miles',
      drivetrain: 'Tri Motor All-Wheel Drive',
      seating: '5 adults',
      cargo: '28 cu ft',
      charging: 'Supercharger V3 compatible'
    },
    tags: ['electric', 'luxury', 'sedan', 'performance'],
    searchKeywords: ['tesla', 'model s', 'electric', 'luxury', 'performance', 'plaid'],
    featured: true,
  });

  const bmwM3 = await ProductModel.create({
    sku: 'CAR-BMW-M3-001',
    name: 'BMW M3 Competition',
    description: 'The ultimate sports sedan. Twin-turbocharged inline-6 engine delivering 503 horsepower.',
    category: 'CARS',
    price: 75000.00,
    stockQuantity: 8,
    brand: 'BMW',
    model: 'M3',
    year: 2024,
    specifications: {
      engine: '3.0L Twin-Turbo I6',
      horsepower: '503 hp',
      torque: '479 lb-ft',
      acceleration: '3.8s 0-60 mph',
      transmission: '8-Speed Automatic',
      drivetrain: 'Rear-Wheel Drive',
      fuelEconomy: '16/23 mpg'
    },
    tags: ['bmw', 'luxury', 'sedan', 'performance', 'german'],
    searchKeywords: ['bmw', 'm3', 'competition', 'luxury', 'performance', 'sports sedan'],
    featured: true,
  });

  const audiA4 = await ProductModel.create({
    sku: 'CAR-AUDI-A4-001',
    name: 'Audi A4 Prestige',
    description: 'Sophisticated luxury sedan with quattro all-wheel drive and premium interior.',
    category: 'CARS',
    price: 48000.00,
    stockQuantity: 12,
    brand: 'Audi',
    model: 'A4',
    year: 2024,
    specifications: {
      engine: '2.0L Turbo I4',
      horsepower: '261 hp',
      torque: '273 lb-ft',
      transmission: '7-Speed Automatic',
      drivetrain: 'quattro All-Wheel Drive',
      fuelEconomy: '24/31 mpg',
      features: 'Virtual Cockpit, MMI Touch'
    },
    tags: ['audi', 'luxury', 'sedan', 'awd', 'german'],
    searchKeywords: ['audi', 'a4', 'prestige', 'luxury', 'quattro', 'sedan'],
    featured: false,
  });

  // Create sample products - Accessories
  console.log('🛠️ Creating accessory products...');
  const carbonSpoiler = await ProductModel.create({
    sku: 'ACC-SPOILER-CF-001',
    name: 'Carbon Fiber Rear Spoiler',
    description: 'Lightweight carbon fiber rear spoiler for enhanced aerodynamics and sporty appearance.',
    category: 'ACCESSORIES',
    price: 1299.99,
    stockQuantity: 25,
    brand: 'AeroTech',
    specifications: {
      material: '100% Carbon Fiber',
      weight: '2.5 kg',
      finish: 'Gloss Carbon Fiber',
      compatibility: 'Universal fit with mounting hardware',
      installation: 'Professional installation recommended'
    },
    tags: ['carbon fiber', 'spoiler', 'aerodynamics', 'performance'],
    searchKeywords: ['spoiler', 'carbon fiber', 'aero', 'rear wing', 'performance'],
    featured: false,
  });

  const premiumCover = await ProductModel.create({
    sku: 'ACC-COVER-PREM-001',
    name: 'Premium All-Weather Car Cover',
    description: 'Heavy-duty car cover with UV protection and waterproof material.',
    category: 'ACCESSORIES',
    price: 249.99,
    stockQuantity: 50,
    brand: 'WeatherShield',
    specifications: {
      material: 'Multi-layer breathable fabric',
      protection: 'UV, Rain, Snow, Dust',
      features: 'Soft fleece lining, Elastic hem',
      sizes: 'Multiple sizes available',
      warranty: '5-year limited warranty'
    },
    tags: ['car cover', 'protection', 'weather', 'uv protection'],
    searchKeywords: ['car cover', 'protection', 'weather', 'uv', 'waterproof'],
    featured: false,
  });

  const ledLights = await ProductModel.create({
    sku: 'ACC-LED-HEAD-001',
    name: 'LED Headlight Conversion Kit',
    description: 'High-performance LED headlight bulbs with 6000K white light output.',
    category: 'PARTS',
    price: 199.99,
    stockQuantity: 100,
    brand: 'BrightTech',
    specifications: {
      brightness: '8000 lumens per set',
      colorTemp: '6000K Pure White',
      lifespan: '50,000+ hours',
      compatibility: 'H7, H11, 9005, 9006',
      cooling: 'Built-in cooling fan'
    },
    tags: ['led', 'headlights', 'lighting', 'upgrade'],
    searchKeywords: ['led headlights', 'bulbs', 'lighting', 'bright', 'white'],
    featured: true,
  });

  // Create sample services
  console.log('✨ Creating services...');
  const ceramicCoating = await ServiceModel.create({
    name: 'Premium Ceramic Coating',
    description: 'Professional 9H ceramic coating application with 5-year warranty. Provides superior protection against UV rays, scratches, and chemical contaminants.',
    category: 'COATING',
    basePrice: 899.00,
    durationHours: 4,
    advanceBookingDays: 2,
    maxAdvanceBookingDays: 60,
    availableDays: [1, 2, 3, 4, 5], // Monday to Friday
    availableHours: [
      { startHour: 8, endHour: 16 }
    ],
    maxDailyBookings: 2,
    preparationInstructions: 'Please ensure your vehicle is thoroughly washed and dried before arrival. Remove all personal items from the vehicle.',
    requirements: 'Vehicle must be clean and free of heavy scratches or swirl marks. Paint correction may be required for optimal results.',
    featured: true,
  });

  const paintCorrection = await ServiceModel.create({
    name: 'Paint Correction & Enhancement',
    description: 'Multi-stage paint correction to remove swirl marks, scratches, and oxidation. Restores paint clarity and depth.',
    category: 'DETAILING',
    basePrice: 599.00,
    durationHours: 6,
    advanceBookingDays: 1,
    maxAdvanceBookingDays: 30,
    availableDays: [1, 2, 3, 4, 5],
    availableHours: [
      { startHour: 7, endHour: 17 }
    ],
    maxDailyBookings: 1,
    preparationInstructions: 'Vehicle should be clean but paint correction will include a thorough wash.',
    requirements: 'Suitable for vehicles with paint imperfections, swirl marks, or light scratches.',
    featured: true,
  });

  const interiorDetail = await ServiceModel.create({
    name: 'Complete Interior Detailing',
    description: 'Comprehensive interior cleaning and protection including leather conditioning, fabric protection, and dashboard treatment.',
    category: 'DETAILING',
    basePrice: 299.00,
    durationHours: 3,
    advanceBookingDays: 1,
    maxAdvanceBookingDays: 21,
    availableDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
    availableHours: [
      { startHour: 9, endHour: 17 }
    ],
    maxDailyBookings: 4,
    preparationInstructions: 'Remove all personal items from the vehicle interior.',
    requirements: 'Service suitable for all vehicle types and interior materials.',
    featured: false,
  });

  const ppfInstall = await ServiceModel.create({
    name: 'Paint Protection Film Installation',
    description: 'Professional installation of premium paint protection film for high-impact areas. Self-healing technology and 10-year warranty.',
    category: 'COATING',
    basePrice: 1299.00,
    durationHours: 8,
    advanceBookingDays: 7,
    maxAdvanceBookingDays: 90,
    availableDays: [1, 2, 3, 4, 5],
    availableHours: [
      { startHour: 8, endHour: 16 }
    ],
    maxDailyBookings: 1,
    preparationInstructions: 'Vehicle must be thoroughly cleaned and free of any wax or sealants.',
    requirements: 'New vehicles preferred. Paint correction may be required for older vehicles.',
    featured: true,
  });

  // Add service add-ons
  console.log('➕ Creating service add-ons...');
  await prisma.serviceAddOn.createMany({
    data: [
      {
        serviceId: ceramicCoating.id,
        name: 'Paint Protection Film Package',
        description: 'Add PPF to high-impact areas before ceramic coating',
        price: 799.00,
        required: false,
      },
      {
        serviceId: ceramicCoating.id,
        name: 'Wheel & Caliper Coating',
        description: 'Ceramic coating for wheels and brake calipers',
        price: 299.00,
        required: false,
      },
      {
        serviceId: paintCorrection.id,
        name: 'Headlight Restoration',
        description: 'Polish and seal headlight lenses',
        price: 149.00,
        required: false,
      },
      {
        serviceId: ppfInstall.id,
        name: 'Full Front End Coverage',
        description: 'Extend coverage to full front bumper and fenders',
        price: 699.00,
        required: false,
      },
      {
        serviceId: interiorDetail.id,
        name: 'Odor Elimination Treatment',
        description: 'Ozone treatment for smoke or pet odors',
        price: 99.00,
        required: false,
      },
    ],
  });

  // Add product images (mock URLs)
  console.log('🖼️ Adding product images...');
  await prisma.productImage.createMany({
    data: [
      // Tesla Model S images
      {
        productId: teslaModelS.id,
        url: 'https://example.com/images/tesla-model-s-1.jpg',
        altText: 'Tesla Model S Plaid - Front View',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: teslaModelS.id,
        url: 'https://example.com/images/tesla-model-s-2.jpg',
        altText: 'Tesla Model S Plaid - Side Profile',
        sortOrder: 1,
        isPrimary: false,
      },
      // BMW M3 images
      {
        productId: bmwM3.id,
        url: 'https://example.com/images/bmw-m3-1.jpg',
        altText: 'BMW M3 Competition - Front View',
        sortOrder: 0,
        isPrimary: true,
      },
      // Audi A4 images
      {
        productId: audiA4.id,
        url: 'https://example.com/images/audi-a4-1.jpg',
        altText: 'Audi A4 Prestige - Front View',
        sortOrder: 0,
        isPrimary: true,
      },
      // Accessory images
      {
        productId: carbonSpoiler.id,
        url: 'https://example.com/images/carbon-spoiler-1.jpg',
        altText: 'Carbon Fiber Rear Spoiler',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: premiumCover.id,
        url: 'https://example.com/images/car-cover-1.jpg',
        altText: 'Premium All-Weather Car Cover',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: ledLights.id,
        url: 'https://example.com/images/led-headlights-1.jpg',
        altText: 'LED Headlight Conversion Kit',
        sortOrder: 0,
        isPrimary: true,
      },
    ],
  });

  // Add sample addresses for test users
  console.log('🏠 Adding user addresses...');
  await prisma.address.createMany({
    data: [
      {
        userId: testUser1.id,
        type: 'SHIPPING',
        streetAddress: '123 Main Street',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
        isDefault: true,
      },
      {
        userId: testUser1.id,
        type: 'BILLING',
        streetAddress: '456 Business Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90211',
        country: 'US',
        isDefault: true,
      },
      {
        userId: testUser2.id,
        type: 'SHIPPING',
        streetAddress: '789 Oak Drive',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94102',
        country: 'US',
        isDefault: true,
      },
    ],
  });

  console.log('✅ Database seed completed successfully!');
  console.log('\n📊 Seed Summary:');
  console.log(`👤 Users created: 4 (1 admin, 3 test users)`);
  console.log(`🚗 Products created: 7 (3 cars, 4 accessories/parts)`);
  console.log(`✨ Services created: 4 (coating, detailing, PPF)`);
  console.log(`➕ Service add-ons created: 5`);
  console.log(`🖼️ Product images added: 7`);
  console.log(`🏠 Addresses created: 3`);
  
  console.log('\n🔐 Test Credentials:');
  console.log('Admin: admin@pakfuturemotors.com / AdminPass123!');
  console.log('Customer: customer@example.com / CustomerPass123!');
  console.log('Phone User: +1234567890 (use OTP: 123456)');
  console.log('Google User: google.user@example.com (social auth)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });