// frontend/src/components/booking/ServiceCard.tsx
import React from 'react';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    description: string;
    price: number;
    duration: number; // in hours
    imageUrl: string;
  };
  onBookService: (serviceId: string) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onBookService }) => {
  return (
    <div className="service-card border p-4 rounded-lg shadow-md">
      <img src={service.imageUrl} alt={service.name} className="w-full h-48 object-cover mb-4 rounded" />
      <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
      <p className="text-gray-600 text-sm mb-2">{service.description}</p>
      <div className="flex justify-between items-center mb-2">
        <span className="text-lg font-bold">${service.price.toLocaleString()}</span>
        <span className="text-gray-500">Duration: {service.duration} hours</span>
      </div>
      <button
        onClick={() => onBookService(service.id)}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Book Now
      </button>
    </div>
  );
};

export default ServiceCard;