/**
 * T009: Services & Bookings Contract Tests
 * Tests service listings, availability checking, booking creation from services-bookings.md
 */
import request from 'supertest';
import app from '../../src/app';

describe('Services & Bookings Contract Tests', () => {
  let accessToken: string;
  let serviceId: string;
  let bookingId: string;

  beforeEach(async () => {
    // Register and login a test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'service@example.com',
        password: 'SecurePass123!',
        first_name: 'Service',
        last_name: 'Test',
        auth_provider: 'email'
      });

    accessToken = userResponse.body.tokens.access_token;

    // Create a test service
    const serviceResponse = await request(app)
      .post('/api/admin/services')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Ceramic Coating',
        description: 'Premium ceramic coating service',
        category: 'coating',
        base_price: 500.00,
        duration_hours: 2,
        advance_booking_days: 1,
        max_advance_booking_days: 30,
        available_days: [1, 2, 3, 4, 5], // Monday to Friday
        available_hours: [
          { start_hour: 9, end_hour: 17 }
        ],
        max_daily_bookings: 4
      });

    serviceId = serviceResponse.body.id;
  });

  describe('GET /api/services', () => {
    it('should list available services', async () => {
      const response = await request(app)
        .get('/api/services');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('services');
      expect(Array.isArray(response.body.services)).toBe(true);
      
      if (response.body.services.length > 0) {
        const service = response.body.services[0];
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('description');
        expect(service).toHaveProperty('category');
        expect(service).toHaveProperty('base_price');
        expect(service).toHaveProperty('duration_hours');
        expect(service).toHaveProperty('add_ons');
        expect(service).toHaveProperty('available_days');
        expect(service).toHaveProperty('available_hours');
      }
    });

    it('should filter services by category', async () => {
      const response = await request(app)
        .get('/api/services')
        .query({
          category: 'coating'
        });

      expect(response.status).toBe(200);
      response.body.services.forEach((service: any) => {
        expect(service.category).toBe('coating');
      });
    });

    it('should show only featured services', async () => {
      const response = await request(app)
        .get('/api/services')
        .query({
          featured: true
        });

      expect(response.status).toBe(200);
      response.body.services.forEach((service: any) => {
        expect(service.featured).toBe(true);
      });
    });

    it('should filter by available date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/services')
        .query({
          available_date: dateString
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.services)).toBe(true);
    });
  });

  describe('GET /api/services/:id', () => {
    it('should get service details', async () => {
      const response = await request(app)
        .get(`/api/services/${serviceId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', serviceId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('preparation_instructions');
      expect(response.body).toHaveProperty('requirements');
      expect(response.body).toHaveProperty('max_daily_bookings');
    });

    it('should return 404 for non-existent service', async () => {
      const response = await request(app)
        .get('/api/services/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SERVICE_NOT_FOUND');
    });
  });

  describe('GET /api/services/:id/availability', () => {
    it('should check service availability with default parameters', async () => {
      const response = await request(app)
        .get(`/api/services/${serviceId}/availability`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service_id', serviceId);
      expect(response.body).toHaveProperty('availability');
      expect(Array.isArray(response.body.availability)).toBe(true);
      
      if (response.body.availability.length > 0) {
        const dayAvailability = response.body.availability[0];
        expect(dayAvailability).toHaveProperty('date');
        expect(dayAvailability).toHaveProperty('available_slots');
        expect(dayAvailability).toHaveProperty('booked_slots');
        expect(dayAvailability).toHaveProperty('blocked_slots');
        expect(Array.isArray(dayAvailability.available_slots)).toBe(true);
        expect(Array.isArray(dayAvailability.booked_slots)).toBe(true);
        expect(Array.isArray(dayAvailability.blocked_slots)).toBe(true);
      }
    });

    it('should check availability for specific date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          date: dateString,
          days: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.availability).toHaveLength(1);
      expect(response.body.availability[0].date).toBe(dateString);
    });

    it('should check availability for multiple days', async () => {
      const response = await request(app)
        .get(`/api/services/${serviceId}/availability`)
        .query({
          days: 7
        });

      expect(response.status).toBe(200);
      expect(response.body.availability.length).toBeLessThanOrEqual(7);
    });

    it('should return 404 for non-existent service', async () => {
      const response = await request(app)
        .get('/api/services/non-existent-id/availability');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SERVICE_NOT_FOUND');
    });
  });

  describe('Booking Management', () => {
    describe('POST /api/bookings', () => {
      it('should create service booking', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];

        const bookingData = {
          service_id: serviceId,
          scheduled_date: dateString,
          scheduled_hour: 10,
          selected_add_ons: [],
          vehicle_make: 'Toyota',
          vehicle_model: 'Camry',
          vehicle_year: 2022,
          special_instructions: 'Please be gentle with the paint',
          payment_method: {
            type: 'credit_card',
            token: 'mock_payment_token',
            billing_address: {
              street_address: '123 Main St',
              city: 'Test City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          }
        };

        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(bookingData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('booking');
        expect(response.body).toHaveProperty('payment');
        
        const booking = response.body.booking;
        expect(booking).toHaveProperty('id');
        expect(booking).toHaveProperty('booking_number');
        expect(booking.service.id).toBe(serviceId);
        expect(booking.scheduled_date).toBe(dateString);
        expect(booking.scheduled_hour).toBe(10);
        expect(booking.vehicle_info.make).toBe('Toyota');
        expect(booking.status).toBe('pending');
        
        const payment = response.body.payment;
        expect(payment).toHaveProperty('id');
        expect(payment).toHaveProperty('status');
        expect(payment).toHaveProperty('amount');
        
        bookingId = booking.id;
      });

      it('should return 400 for unavailable time slot', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateString = yesterday.toISOString().split('T')[0];

        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            service_id: serviceId,
            scheduled_date: dateString, // Past date
            scheduled_hour: 10,
            selected_add_ons: [],
            payment_method: {
              type: 'credit_card',
              token: 'mock_payment_token',
              billing_address: {
                street_address: '123 Main St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('TIME_SLOT_UNAVAILABLE');
      });

      it('should return 400 for invalid booking date', async () => {
        const farFuture = new Date();
        farFuture.setDate(farFuture.getDate() + 100); // Beyond max advance booking
        const dateString = farFuture.toISOString().split('T')[0];

        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            service_id: serviceId,
            scheduled_date: dateString,
            scheduled_hour: 10,
            selected_add_ons: [],
            payment_method: {
              type: 'credit_card',
              token: 'mock_payment_token',
              billing_address: {
                street_address: '123 Main St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_BOOKING_DATE');
      });

      it('should return 404 for non-existent service', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];

        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            service_id: 'non-existent-service',
            scheduled_date: dateString,
            scheduled_hour: 10,
            selected_add_ons: [],
            payment_method: {
              type: 'credit_card',
              token: 'mock_payment_token',
              billing_address: {
                street_address: '123 Main St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('SERVICE_NOT_FOUND');
      });

      it('should require authentication', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];

        const response = await request(app)
          .post('/api/bookings')
          .send({
            service_id: serviceId,
            scheduled_date: dateString,
            scheduled_hour: 10,
            selected_add_ons: [],
            payment_method: {
              type: 'credit_card',
              token: 'mock_payment_token',
              billing_address: {
                street_address: '123 Main St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('INVALID_TOKEN');
      });
    });

    describe('GET /api/bookings', () => {
      beforeEach(async () => {
        // Create a test booking
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];

        const bookingResponse = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            service_id: serviceId,
            scheduled_date: dateString,
            scheduled_hour: 14,
            selected_add_ons: [],
            payment_method: {
              type: 'credit_card',
              token: 'mock_payment_token',
              billing_address: {
                street_address: '123 Main St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        bookingId = bookingResponse.body.booking.id;
      });

      it('should list user bookings', async () => {
        const response = await request(app)
          .get('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('bookings');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.bookings)).toBe(true);
        expect(response.body.bookings.length).toBeGreaterThan(0);
      });

      it('should filter bookings by status', async () => {
        const response = await request(app)
          .get('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            status: 'pending'
          });

        expect(response.status).toBe(200);
        response.body.bookings.forEach((booking: any) => {
          expect(booking.status).toBe('pending');
        });
      });

      it('should filter bookings by date range', async () => {
        const today = new Date().toISOString().split('T')[0];
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const futureDateString = futureDate.toISOString().split('T')[0];

        const response = await request(app)
          .get('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            from_date: today,
            to_date: futureDateString
          });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.bookings)).toBe(true);
      });
    });

    describe('GET /api/bookings/:id', () => {
      beforeEach(async () => {
        // Create a test booking
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];

        const bookingResponse = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            service_id: serviceId,
            scheduled_date: dateString,
            scheduled_hour: 15,
            selected_add_ons: [],
            payment_method: {
              type: 'credit_card',
              token: 'mock_payment_token',
              billing_address: {
                street_address: '123 Main St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        bookingId = bookingResponse.body.booking.id;
      });

      it('should get booking details', async () => {
        const response = await request(app)
          .get(`/api/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', bookingId);
        expect(response.body).toHaveProperty('booking_number');
        expect(response.body).toHaveProperty('service');
        expect(response.body).toHaveProperty('payment');
        expect(response.body).toHaveProperty('status_history');
        expect(Array.isArray(response.body.status_history)).toBe(true);
      });

      it('should return 404 for non-existent booking', async () => {
        const response = await request(app)
          .get('/api/bookings/non-existent-id')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
      });
    });

    describe('PUT /api/bookings/:id', () => {
      beforeEach(async () => {
        // Create a test booking
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];

        const bookingResponse = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            service_id: serviceId,
            scheduled_date: dateString,
            scheduled_hour: 16,
            selected_add_ons: [],
            payment_method: {
              type: 'credit_card',
              token: 'mock_payment_token',
              billing_address: {
                street_address: '123 Main St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        bookingId = bookingResponse.body.booking.id;
      });

      it('should update booking details', async () => {
        const updateData = {
          vehicle_make: 'Honda',
          vehicle_model: 'Accord',
          vehicle_year: 2023,
          special_instructions: 'Updated instructions'
        };

        const response = await request(app)
          .put(`/api/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.vehicle_info.make).toBe('Honda');
        expect(response.body.vehicle_info.model).toBe('Accord');
        expect(response.body.vehicle_info.year).toBe(2023);
        expect(response.body.special_instructions).toBe('Updated instructions');
      });
    });

    describe('POST /api/bookings/:id/cancel', () => {
      beforeEach(async () => {
        // Create a test booking
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];

        const bookingResponse = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            service_id: serviceId,
            scheduled_date: dateString,
            scheduled_hour: 11,
            selected_add_ons: [],
            payment_method: {
              type: 'credit_card',
              token: 'mock_payment_token',
              billing_address: {
                street_address: '123 Main St',
                city: 'Test City',
                state: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            }
          });

        bookingId = bookingResponse.body.booking.id;
      });

      it('should cancel booking', async () => {
        const response = await request(app)
          .post(`/api/bookings/${bookingId}/cancel`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            reason: 'Change of plans'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('refund_info');
        expect(response.body.refund_info).toHaveProperty('amount');
        expect(response.body.refund_info).toHaveProperty('processing_time');
      });
    });
  });
});