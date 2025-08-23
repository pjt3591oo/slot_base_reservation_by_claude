import React from 'react';
import { type Section } from '../types';
import { formatPrice, getOccupancyColor } from '../utils/formatters';

interface SectionCardProps {
  section: Section;
  onSelect: (section: Section) => void;
}

const SectionCard: React.FC<SectionCardProps> = ({ section, onSelect }) => {
  const occupancyRate = Math.round((section.currentOccupancy / section.totalCapacity) * 100);
  const isAvailable = section.status === 'open' && section.availableSeats > 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{section.name}</h3>
          {section.location && (
            <p className="text-sm text-gray-500">{section.location}</p>
          )}
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${
          section.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {section.status === 'open' ? '예약 가능' : '예약 불가'}
        </span>
      </div>

      {section.description && (
        <p className="text-sm text-gray-600 mb-4">{section.description}</p>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">총 좌석</span>
          <span className="font-medium">{section.totalCapacity}석</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">잔여 좌석</span>
          <span className={`font-medium ${getOccupancyColor(occupancyRate)}`}>
            {section.availableSeats}석
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">점유율</span>
          <span className={`font-medium ${getOccupancyColor(occupancyRate)}`}>
            {occupancyRate}%
          </span>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div 
          className={`h-2 rounded-full transition-all ${
            occupancyRate >= 90 ? 'bg-red-500' : 
            occupancyRate >= 70 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${occupancyRate}%` }}
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-lg font-bold text-gray-900">
          {formatPrice(section.price)}
        </span>
        <button
          onClick={() => onSelect(section)}
          disabled={!isAvailable}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isAvailable
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isAvailable ? '선택하기' : '매진'}
        </button>
      </div>
    </div>
  );
};

export default SectionCard;