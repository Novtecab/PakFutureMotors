// frontend/tests/components/booking.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ServiceCard from '../../src/components/booking/ServiceCard';
import AvailabilityCalendar from '../../src/components/booking/AvailabilityCalendar';
import BookingForm from '../../src/components/booking/BookingForm';
import BookingConfirmation from '../../src/components/booking/BookingConfirmation';

// Mock data for testing
const mockService = {
  id: 's1',
  name: 'Ceramic Coating',
  description: 'Premium ceramic coating for your car.',
  price: 1200,
  duration: 3, // hours
  imageUrl: '/images/ceramic-coating.jpg',
};

const mockAvailability = [
  { date: '2025-01-10', slots: ['09:00', '10:00', '11:00'] },
  { date: '2025-01-11', slots: ['14:00', '15:00'] },
];

const mockBookingDetails = {
  serviceName: 'Ceramic Coating',
  date: '2025-01-10',
  time: '09:00',
  customerName: 'John Doe',
  customerEmail: 'john.doe@example.com',
  totalPrice: 1200,
};

describe('ServiceCard', () => {
  it('renders service information correctly', () => {
    render(<ServiceCard service={mockService} onBookService={() => {}} />);
    expect(screen.getByText('Ceramic Coating')).toBeInTheDocument();
    expect(screen.getByText('Premium ceramic coating for your car.')).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();
    expect(screen.getByText('Duration: 3 hours')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ceramic Coating' })).toHaveAttribute('src', '/images/ceramic-coating.jpg');
  });

  it('calls onBookService when button is clicked', () => {
    const onBookService = vi.fn();
    render(<ServiceCard service={mockService} onBookService={onBookService} />);
    fireEvent.click(screen.getByRole('button', { name: /book now/i }));
    expect(onBookService).toHaveBeenCalledWith(mockService.id);
  });
});

describe('AvailabilityCalendar', () => {
  it('renders available dates and slots', () => {
    const onSelectSlot = vi.fn();
    render(<AvailabilityCalendar availability={mockAvailability} onSelectSlot={onSelectSlot} />);

    expect(screen.getByText('2025-01-10')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('11:00')).toBeInTheDocument();
    expect(screen.getByText('2025-01-11')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('calls onSelectSlot when a slot is clicked', () => {
    const onSelectSlot = vi.fn();
    render(<AvailabilityCalendar availability={mockAvailability} onSelectSlot={onSelectSlot} />);
    fireEvent.click(screen.getByText('09:00'));
    expect(onSelectSlot).toHaveBeenCalledWith('2025-01-10', '09:00');
  });
});

describe('BookingForm', () => {
  it('renders form fields and submits data', async () => {
    const onSubmit = vi.fn();
    render(<BookingForm serviceName="Ceramic Coating" selectedDate="2025-01-10" selectedTime="09:00" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'jane.doe@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      customerName: 'Jane Doe',
      customerEmail: 'jane.doe@example.com',
    });
  });
});

describe('BookingConfirmation', () => {
  it('renders booking details', () => {
    render(<BookingConfirmation bookingDetails={mockBookingDetails} />);
    expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
    expect(screen.getByText(/ceramic coating/i)).toBeInTheDocument();
    expect(screen.getByText(/2025-01-10 at 09:00/i)).toBeInTheDocument();
    expect(screen.getByText(/john doe/i)).toBeInTheDocument();
    expect(screen.getByText(/john.doe@example.com/i)).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();
  });
});