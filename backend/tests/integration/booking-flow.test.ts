/**
 * T013: Service booking complete flow integration test
 * Browse services, check availability, create booking, payment processing
 */
import request from 'supertest';
import app from '../../src/app';

describe('Service Booking Flow Integration Tests', () => {
  let accessToken: string;
  let userId: string;
  let serviceId: string;
  let addOnId: string;
  let bookingId: string;

  beforeEach(async () => {
    // Register user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'booking@example.com',
        password: 'SecurePass123!',
        first_name: 'Booking',
        last_name: 'Test',
        auth_provider: 'email'
      });

    accessToken = userResponse.body.tokens.access_token;
    userId = userResponse.body.user.id;

    // Create test service with add-ons
    const serviceResponse = await request(app)
      .post('/api/admin/services')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Premium Ceramic Coating',
        description: 'Professional ceramic coating with 5-year warranty',
        category: 'coating',
        base_price: 800.00,
        duration_hours: 3,
        advance_booking_days: 2,
        max_advance_booking_days: 45,
        available_days: [1, 2, 3, 4, 5], // Monday to Friday
        available_hours: [
          { start_hour: 8, end_hour: 18 }
        ],
        max_daily_bookings: 3,
        preparation_instructions: 'Please wash your vehicle thoroughly before arrival',
        requirements: 'Vehicle must be clean and dry',
        featured: true
      });

    serviceId = serviceResponse.body.id;

    // Add service add-ons
    const addOnResponse = await request(app)
      .post(`/api/admin/services/${serviceId}/add-ons`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Paint Protection Film',
        description: 'Additional paint protection film for high-impact areas',
        price: 400.00,
        required: false
      });

    addOnId = addOnResponse.body.id;
  });

  describe('Service Discovery Flow', () => {
    it('should complete service browsing journey', async () => {
      // Step 1: Browse all services
      const browseServices = await request(app)
        .get('/api/services');

      expect(browseServices.status).toBe(200);
      expect(browseServices.body.services).toHaveLength(1);
      expect(browseServices.body.services[0].id).toBe(serviceId);
      expect(browseServices.body.services[0]).toHaveProperty('add_ons');
      expect(browseServices.body.services[0]).toHaveProperty('available_days');
      expect(browseServices.body.services[0]).toHaveProperty('available_hours');

      // Step 2: Filter by category
      const filterCoating = await request(app)
        .get('/api/services')
        .query({
          category: 'coating'
        });

      expect(filterCoating.status).toBe(200);
      expect(filterCoating.body.services).toHaveLength(1);
      expect(filterCoating.body.services[0].category).toBe('coating');

      // Step 3: Show only featured services
      const featuredServices = await request(app)
        .get('/api/services')
        .query({
          featured: true
        });

      expect(featuredServices.status).toBe(200);
      expect(featuredServices.body.services).toHaveLength(1);
      expect(featuredServices.body.services[0].featured).toBe(true);

      // Step 4: Filter by available date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3); // 3 days ahead to meet advance booking requirement
      const dateString = tomorrow.toISOString().split('T')[0];

      const availableOnDate = await request(app)
        .get('/api/services')
        .query({
          available_date: dateString
        });

      expect(availableOnDate.status).toBe(200);
      expect(availableOnDate.body.services.length).toBeGreaterThanOrEqual(0);

      // Step 5: Get service details
      const serviceDetails = await request(app)
        .get(`/api/services/${serviceId}`);

      expect(serviceDetails.status).toBe(200);
      expect(serviceDetails.body.id).toBe(serviceId);
      expect(serviceDetails.body).toHaveProperty('preparation_instructions');
      expect(serviceDetails.body).toHaveProperty('requirements');
      expect(serviceDetails.body).toHaveProperty('max_daily_bookings');
      expect(serviceDetails.body.preparation_instructions).toContain('wash');
    });
  });

  describe('Availability Checking Flow', () => {
    it('should complete availability checking journey', async () => {
      // Step 1: Check default availability (next 30 days)
      const defaultAvailability = await request(app)
        .get(`/api/services/${serviceId}/availability`);

      expect(defaultAvailability.status).toBe(200);
      expect(defaultAvailability.body.service_id).toBe(serviceId);
      expect(defaultAvailability.body.availability).toHaveLength(30);
      
      const firstDay = defaultAvailability.body.availability[0];
      expect(firstDay).toHaveProperty('date');
      expect(firstDay).toHaveProperty('available_slots');
      expect(firstDay).toHaveProperty('booked_slots');
      expect(firstDay).toHaveProperty('blocked_slots');
      expect(Array.isArray(firstDay.available_slots)).toBe(true);

      // Step 2: Check availability for specific date
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 7); // One week ahead
      const dateString = targetDate.toISOString().split('T')[0];

      const specificDate = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          date: dateString,
          days: 1
        });

      expect(specificDate.status).toBe(200);
      expect(specificDate.body.availability).toHaveLength(1);
      expect(specificDate.body.availability[0].date).toBe(dateString);

      // Verify available slots match service configuration
      const availableSlots = specificDate.body.availability[0].available_slots;
      expect(availableSlots.length).toBeGreaterThan(0);
      availableSlots.forEach((slot: any) => {
        expect(slot.start_hour).toBeGreaterThanOrEqual(8);
        expect(slot.end_hour).toBeLessThanOrEqual(18);
      });

      // Step 3: Check availability for multiple days
      const multipleDays = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          days: 7
        });

      expect(multipleDays.status).toBe(200);
      expect(multipleDays.body.availability.length).toBeLessThanOrEqual(7);

      // Step 4: Check availability on weekend (should have no slots)
      const weekend = new Date();
      // Find next Saturday
      const daysUntilSaturday = (6 - weekend.getDay() + 7) % 7;
      weekend.setDate(weekend.getDate() + daysUntilSaturday + 7); // Next Saturday
      const weekendString = weekend.toISOString().split('T')[0];

      const weekendAvailability = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          date: weekendString,
          days: 1
        });

      expect(weekendAvailability.status).toBe(200);
      expect(weekendAvailability.body.availability[0].available_slots).toHaveLength(0);
    });
  });

  describe('Complete Booking Flow', () => {
    it('should complete full booking journey with payment', async () => {
      // Step 1: Choose booking date and time
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 5); // 5 days ahead
      const dateString = bookingDate.toISOString().split('T')[0];

      // First verify availability
      const checkAvailability = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          date: dateString,
          days: 1
        });

      expect(checkAvailability.status).toBe(200);
      const availableSlots = checkAvailability.body.availability[0].available_slots;
      expect(availableSlots.length).toBeGreaterThan(0);

      const selectedSlot = availableSlots[0];
      const selectedHour = selectedSlot.start_hour;

      // Step 2: Create booking with add-ons
      const createBooking = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          service_id: serviceId,
          scheduled_date: dateString,
          scheduled_hour: selectedHour,
          selected_add_ons: [addOnId],
          vehicle_make: 'BMW',
          vehicle_model: 'X5',
          vehicle_year: 2023,
          special_instructions: 'Please be extra careful with the metallic paint',
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {
              street_address: '123 Booking St',
              city: 'Booking City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          }
        });

      expect(createBooking.status).toBe(201);
      expect(createBooking.body).toHaveProperty('booking');
      expect(createBooking.body).toHaveProperty('payment');

      const booking = createBooking.body.booking;
      expect(booking.service.id).toBe(serviceId);
      expect(booking.scheduled_date).toBe(dateString);
      expect(booking.scheduled_hour).toBe(selectedHour);
      expect(booking.vehicle_info.make).toBe('BMW');
      expect(booking.selected_add_ons).toHaveLength(1);
      expect(booking.total_amount).toBe(1200.00); // 800 base + 400 add-on
      expect(booking.status).toBe('pending');

      const payment = createBooking.body.payment;
      expect(payment.amount).toBe(1200.00);
      expect(payment.status).toBe('processing');

      bookingId = booking.id;

      // Step 3: Verify booking appears in user's bookings
      const userBookings = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(userBookings.status).toBe(200);
      expect(userBookings.body.bookings).toHaveLength(1);
      expect(userBookings.body.bookings[0].id).toBe(bookingId);

      // Step 4: Get detailed booking information
      const bookingDetails = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(bookingDetails.status).toBe(200);
      expect(bookingDetails.body.id).toBe(bookingId);
      expect(bookingDetails.body).toHaveProperty('status_history');
      expect(bookingDetails.body.status_history).toHaveLength(1);
      expect(bookingDetails.body.status_history[0].status).toBe('pending');

      // Step 5: Update booking details
      const updateBooking = await request(app)
        .put(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          vehicle_make: 'Mercedes',
          vehicle_model: 'E-Class',
          special_instructions: 'Updated: Mercedes E-Class with updated instructions'
        });

      expect(updateBooking.status).toBe(200);
      expect(updateBooking.body.vehicle_info.make).toBe('Mercedes');
      expect(updateBooking.body.vehicle_info.model).toBe('E-Class');
      expect(updateBooking.body.special_instructions).toContain('Updated');

      // Step 6: Verify time slot is now unavailable
      const verifyUnavailable = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          date: dateString,
          days: 1
        });

      expect(verifyUnavailable.status).toBe(200);
      const bookedSlots = verifyUnavailable.body.availability[0].booked_slots;
      const isSlotBooked = bookedSlots.some((slot: any) => slot.start_hour === selectedHour);
      expect(isSlotBooked).toBe(true);
    });
  });

  describe('Booking Management Flow', () => {
    beforeEach(async () => {
      // Create a test booking
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 10);
      const dateString = bookingDate.toISOString().split('T')[0];

      const createBooking = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          service_id: serviceId,
          scheduled_date: dateString,
          scheduled_hour: 10,
          selected_add_ons: [],
          vehicle_make: 'Audi',
          vehicle_model: 'A4',
          vehicle_year: 2022,
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {
              street_address: '456 Test Ave',
              city: 'Test City',
              state: 'NY',
              postal_code: '67890',
              country: 'US'
            }
          }
        });

      bookingId = createBooking.body.booking.id;
    });

    it('should complete booking management journey', async () => {
      // Step 1: Filter bookings by status
      const pendingBookings = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          status: 'pending'
        });

      expect(pendingBookings.status).toBe(200);
      pendingBookings.body.bookings.forEach((booking: any) => {
        expect(booking.status).toBe('pending');
      });

      // Step 2: Filter bookings by date range
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateString = futureDate.toISOString().split('T')[0];

      const dateRangeBookings = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          from_date: today,
          to_date: futureDateString
        });

      expect(dateRangeBookings.status).toBe(200);
      expect(dateRangeBookings.body.bookings.length).toBeGreaterThan(0);

      // Step 3: Admin confirms booking
      const confirmBooking = await request(app)
        .put(`/api/admin/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'confirmed',
          notes: 'Booking confirmed by admin'
        });

      expect(confirmBooking.status).toBe(200);
      expect(confirmBooking.body.status).toBe('confirmed');

      // Step 4: Verify status change
      const verifyStatus = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(verifyStatus.status).toBe(200);
      expect(verifyStatus.body.status).toBe('confirmed');
      expect(verifyStatus.body.status_history).toHaveLength(2);
      expect(verifyStatus.body.confirmed_at).toBeTruthy();

      // Step 5: Cancel booking
      const cancelBooking = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'Schedule conflict'
        });

      expect(cancelBooking.status).toBe(200);
      expect(cancelBooking.body.success).toBe(true);
      expect(cancelBooking.body).toHaveProperty('refund_info');
      expect(cancelBooking.body.refund_info.amount).toBe(800.00);

      // Step 6: Verify cancellation
      const verifyCancel = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(verifyCancel.status).toBe(200);
      expect(verifyCancel.body.status).toBe('cancelled');

      // Step 7: Verify time slot is available again
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 10);
      const dateString = bookingDate.toISOString().split('T')[0];

      const checkAvailability = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          date: dateString,
          days: 1
        });

      expect(checkAvailability.status).toBe(200);
      const bookedSlots = checkAvailability.body.availability[0].booked_slots;
      const isSlotBooked = bookedSlots.some((slot: any) => slot.start_hour === 10);
      expect(isSlotBooked).toBe(false);
    });
  });

  describe('Admin Service Management Flow', () => {
    it('should complete admin service management journey', async () => {
      // Step 1: Get all bookings for admin
      const adminBookings = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(adminBookings.status).toBe(200);
      expect(adminBookings.body).toHaveProperty('bookings');
      expect(adminBookings.body).toHaveProperty('pagination');

      // Step 2: Get calendar view
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekString = nextWeek.toISOString().split('T')[0];

      const calendar = await request(app)
        .get('/api/admin/bookings/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          from_date: today,
          to_date: nextWeekString
        });

      expect(calendar.status).toBe(200);
      expect(calendar.body).toHaveProperty('calendar_events');
      expect(Array.isArray(calendar.body.calendar_events)).toBe(true);

      // Step 3: Block time for maintenance
      const blockDate = new Date();
      blockDate.setDate(blockDate.getDate() + 15);
      const blockDateString = blockDate.toISOString().split('T')[0];

      const blockTime = await request(app)
        .post(`/api/admin/services/${serviceId}/block-time`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: blockDateString,
          start_hour: 14,
          end_hour: 16,
          reason: 'Equipment maintenance'
        });

      expect(blockTime.status).toBe(200);
      expect(blockTime.body.success).toBe(true);

      // Step 4: Verify time is blocked
      const verifyBlocked = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          date: blockDateString,
          days: 1
        });

      expect(verifyBlocked.status).toBe(200);
      const blockedSlots = verifyBlocked.body.availability[0].blocked_slots;
      const isBlocked = blockedSlots.some((slot: any) => 
        slot.start_hour === 14 && slot.end_hour === 16
      );
      expect(isBlocked).toBe(true);

      // Step 5: Update service details
      const updateService = await request(app)
        .put(`/api/admin/services/${serviceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          base_price: 850.00,
          max_daily_bookings: 4,
          preparation_instructions: 'Updated: Please wash and dry your vehicle completely'
        });

      expect(updateService.status).toBe(200);
      expect(updateService.body.base_price).toBe(850.00);
      expect(updateService.body.max_daily_bookings).toBe(4);
    });
  });

  describe('Error Handling in Booking Flow', () => {
    it('should handle booking errors gracefully', async () => {
      // Test booking non-existent service
      const invalidService = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          service_id: 'invalid-service-id',
          scheduled_date: '2024-12-31',
          scheduled_hour: 10,
          selected_add_ons: [],
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {}
          }
        });

      expect(invalidService.status).toBe(404);
      expect(invalidService.body.error.code).toBe('SERVICE_NOT_FOUND');

      // Test booking past date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateString = pastDate.toISOString().split('T')[0];

      const pastBooking = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          service_id: serviceId,
          scheduled_date: pastDateString,
          scheduled_hour: 10,
          selected_add_ons: [],
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {}
          }
        });

      expect(pastBooking.status).toBe(400);
      expect(pastBooking.body.error.code).toBe('INVALID_BOOKING_DATE');

      // Test booking outside advance booking window
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 60); // Beyond 45-day limit
      const farFutureString = farFuture.toISOString().split('T')[0];

      const farFutureBooking = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          service_id: serviceId,
          scheduled_date: farFutureString,
          scheduled_hour: 10,
          selected_add_ons: [],
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {}
          }
        });

      expect(farFutureBooking.status).toBe(400);
      expect(farFutureBooking.body.error.code).toBe('INVALID_BOOKING_DATE');

      // Test booking outside business hours
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 7);
      const validDateString = validDate.toISOString().split('T')[0];

      const outsideHours = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          service_id: serviceId,
          scheduled_date: validDateString,
          scheduled_hour: 20, // 8 PM, outside 8 AM - 6 PM window
          selected_add_ons: [],
          payment_method: {
            type: 'credit_card',
            token: 'tok_visa',
            billing_address: {}
          }
        });

      expect(outsideHours.status).toBe(400);
      expect(outsideHours.body.error.code).toBe('TIME_SLOT_UNAVAILABLE');
    });
  });
});