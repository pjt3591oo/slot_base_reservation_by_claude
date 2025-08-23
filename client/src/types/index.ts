export interface Section {
  id: string;
  name: string;
  description?: string;
  totalCapacity: number;
  currentOccupancy: number;
  availableSeats: number;
  status: 'open' | 'closed' | 'maintenance';
  price: number;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  userId: string;
  sectionId: string;
  quantity: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  confirmationCode: string;
  totalPrice?: number;
  expiresAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  section?: Section;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
}

export interface SectionStats {
  id: string;
  name: string;
  totalCapacity: number;
  currentOccupancy: number;
  availableSeats: number;
  occupancyRate: number;
}

export interface ReservationStats {
  pending: {
    count: number;
    totalQuantity: number;
  };
  confirmed: {
    count: number;
    totalQuantity: number;
  };
  cancelled: {
    count: number;
    totalQuantity: number;
  };
  expired?: {
    count: number;
    totalQuantity: number;
  };
}