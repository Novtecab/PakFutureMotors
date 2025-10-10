// frontend/src/components/booking/BookingConfirmation.tsx
import React from 'react';

interface BookingConfirmationProps {
  bookingDetails: {
    serviceName: string;
    date: string;
    time: string;
    customerName: string;
    customerEmail: string;
    totalPrice: number;
    vehicleInfo?: string;
  };
}

const BookingConfirmation: React.FC<BookingConfirmationProps> = ({ bookingDetails }) => {
  return (
    <div className="booking-confirmation p-6 border rounded-lg shadow-lg bg-green-50 text-green-800">
      <h3 className="text-2xl font-bold mb-4 text-center">Booking Confirmed! 🎉</h3>
      <p className="mb-2">
        Thank you, <span className="font-semibold">{bookingDetails.customerName}</span>, for your booking.
      </p>
      <p className="mb-4">
        A confirmation email has been sent to <span className="font-semibold">{bookingDetails.customerEmail}</span>.
      </p>

      <div className="bg-white p-4 rounded-md shadow-sm border border-green-200">
        <h4 className="text-xl font-semibold mb-3 text-green-700">Booking Details:</h4>
        <p className="mb-1">
          <span className="font-medium">Service:</span> {bookingDetails.serviceName}
        </p>
        <p className="mb-1">
          <span className="font-medium">Date & Time:</span> {bookingDetails.date} at {bookingDetails.time}
        </p>
        {bookingDetails.vehicleInfo && (
          <p className="mb-1">
            <span className="font-medium">Vehicle Info:</span> {bookingDetails.vehicleInfo}
          </p>
        )}
        <p className="text-lg font-bold mt-3">
          Total Price: <span className="text-green-700">${bookingDetails.totalPrice.toLocaleString()}</span>
        </p>
      </div>

      <p className="mt-6 text-center text-gray-600">
        We look forward to seeing you!
      </p>
    </div>
  );
};

export default BookingConfirmation;