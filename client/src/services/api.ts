import axios, { type AxiosInstance } from 'axios';
import { 
  type Section, 
  type Reservation, 
  type ApiResponse, 
  type SectionStats, 
  type ReservationStats 
} from '../types/index';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.DEV ? '/api' : 'http://localhost:3000/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const userId = localStorage.getItem('userId');
        if (userId) {
          config.headers['X-User-Id'] = userId;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.data?.error?.message) {
          throw new Error(error.response.data.error.message);
        }
        throw error;
      }
    );
  }

  // Section APIs
  async getAvailableSections(): Promise<ApiResponse<{ sections: Section[]; count: number }>> {
    return this.api.get('/sections/available');
  }

  async getSectionById(id: string): Promise<ApiResponse<Section>> {
    return this.api.get(`/sections/${id}`);
  }

  async getSectionStats(): Promise<ApiResponse<SectionStats[]>> {
    return this.api.get('/sections/stats');
  }

  // Reservation APIs
  async createReservation(sectionId: string, quantity: number, userId: string): Promise<ApiResponse<Reservation>> {
    return this.api.post('/reservations', { sectionId, quantity, userId });
  }

  async confirmReservation(id: string, userId: string): Promise<ApiResponse<Reservation>> {
    return this.api.post(`/reservations/${id}/confirm`, { userId });
  }

  async cancelReservation(id: string, userId: string): Promise<ApiResponse<Reservation>> {
    return this.api.post(`/reservations/${id}/cancel`, { userId });
  }

  async getReservation(id: string, userId: string): Promise<ApiResponse<Reservation>> {
    return this.api.get(`/reservations/${id}`, { params: { userId } });
  }

  async getUserReservations(userId: string, status?: string): Promise<ApiResponse<{ reservations: Reservation[]; count: number }>> {
    return this.api.get('/reservations/user', { params: { userId, status } });
  }

  async getReservationStats(sectionId?: string): Promise<ApiResponse<ReservationStats>> {
    return this.api.get('/reservations/stats', { params: { sectionId } });
  }
}

export default new ApiService();