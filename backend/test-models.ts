/**
 * Quick test to verify database models are working
 */
import UserModel from '../src/models/User';
import ProductModel from '../src/models/Product';
import ServiceModel from '../src/models/Service';

async function testModels() {
  console.log('🧪 Testing database models...');

  try {
    // Test User model
    console.log('👤 Testing User model...');
    const testUser = await UserModel.create({
      email: 'test@models.com',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      authProvider: 'email',
    });
    console.log('✅ User created:', testUser.id);

    // Test Product model
    console.log('📦 Testing Product model...');
    const testProduct = await ProductModel.create({
      sku: 'TEST-MODEL-001',
      name: 'Test Product',
      description: 'A test product for model verification',
      category: 'ACCESSORIES',
      price: 99.99,
      stockQuantity: 10,
      brand: 'TestBrand',
    });
    console.log('✅ Product created:', testProduct.id);

    // Test Service model
    console.log('⚙️ Testing Service model...');
    const testService = await ServiceModel.create({
      name: 'Test Service',
      description: 'A test service for model verification',
      category: 'DETAILING',
      basePrice: 199.99,
      durationHours: 2,
      advanceBookingDays: 1,
      maxAdvanceBookingDays: 30,
      availableDays: [1, 2, 3, 4, 5],
      availableHours: [{ startHour: 9, endHour: 17 }],
      maxDailyBookings: 3,
    });
    console.log('✅ Service created:', testService.id);

    console.log('🎉 All models working correctly!');

  } catch (error) {
    console.error('❌ Model test failed:', error);
    process.exit(1);
  }
}

testModels()
  .catch(console.error)
  .finally(() => process.exit(0));