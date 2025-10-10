// frontend/src/components/booking/AvailabilityCalendar.tsx
import React from 'react';

interface AvailabilitySlot {
  date: string; // YYYY-MM-DD
  slots: string[]; // HH:MM
}

interface AvailabilityCalendarProps {
  availability: AvailabilitySlot[];
  onSelectSlot: (date: string, time: string) => void;
  selectedDate?: string | null;
  selectedTime?: string | null;
}

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  availability,
  onSelectSlot,
  selectedDate,
  selectedTime,
}) => {
  return (
    <div className="availability-calendar p-4 border rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Select an Appointment Slot</h3>
      {availability.length === 0 ? (
        <p className="text-center text-gray-500">No availability found for selected service.</p>
      ) : (
        <div className="space-y-4">
          {availability.map((day) => (
            <div key={day.date} className="border p-3 rounded-lg">
              <h4 className="font-bold mb-2">{day.date}</h4>
              <div className="flex flex-wrap gap-2">
                {day.slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => onSelectSlot(day.date, slot)}
                    className={`px-3 py-1 rounded-md text-sm ${
                      selectedDate === day.date && selectedTime === slot
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;