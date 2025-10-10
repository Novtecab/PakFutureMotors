// frontend/src/components/booking/BookingForm.tsx
import React, { useState } from 'react';

interface BookingFormProps {
  serviceName: string;
  selectedDate: string;
  selectedTime: string;
  onSubmit: (bookingDetails: { customerName: string; customerEmail: string; vehicleInfo?: string }) => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ serviceName, selectedDate, selectedTime, onSubmit }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ customerName, customerEmail, vehicleInfo });
  };

  return (
    <div className="booking-form p-4 border rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Confirm Your Booking for {serviceName}</h3>
      <p className="mb-2">
        <span className="font-bold">Date:</span> {selectedDate}
      </p>
      <p className="mb-4">
        <span className="font-bold">Time:</span> {selectedTime}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">
            Your Name
          </label>
          <input
            type="text"
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700">
            Your Email
          </label>
          <input
            type="email"
            id="customerEmail"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            required
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="vehicleInfo" className="block text-sm font-medium text-gray-700">
            Vehicle Information (Make, Model, Year - Optional)
          </label>
          <textarea
            id="vehicleInfo"
            value={vehicleInfo}
            onChange={(e) => setVehicleInfo(e.target.value)}
            rows={3}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
        >
          Confirm Booking
        </button>
      </form>
    </div>
  );
};

export default BookingForm;