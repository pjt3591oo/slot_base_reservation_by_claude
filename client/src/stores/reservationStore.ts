import { create } from 'zustand';
import { type Section, type Reservation } from '../types';
import api from '../services/api';

interface ReservationState {
  // State
  sections: Section[];
  selectedSection: Section | null;
  selectedQuantity: number;
  userReservations: Reservation[];
  currentReservation: Reservation | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchSections: () => Promise<void>;
  selectSection: (section: Section) => void;
  setQuantity: (quantity: number) => void;
  createReservation: (userId: string) => Promise<Reservation | null>;
  confirmReservation: (reservationId: string, userId: string) => Promise<void>;
  cancelReservation: (reservationId: string, userId: string) => Promise<void>;
  fetchUserReservations: (userId: string, status?: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const useReservationStore = create<ReservationState>((set, get) => ({
  // Initial state
  sections: [],
  selectedSection: null,
  selectedQuantity: 1,
  userReservations: [],
  currentReservation: null,
  loading: false,
  error: null,

  // Actions
  fetchSections: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.getAvailableSections();
      if (response.success && response.data) {
        set({ sections: response.data.sections, loading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch sections', loading: false });
    }
  },

  selectSection: (section) => {
    set({ selectedSection: section });
  },

  setQuantity: (quantity) => {
    set({ selectedQuantity: quantity });
  },

  createReservation: async (userId) => {
    const { selectedSection, selectedQuantity } = get();
    if (!selectedSection) {
      set({ error: 'No section selected' });
      return null;
    }

    set({ loading: true, error: null });
    try {
      const response = await api.createReservation(selectedSection.id, selectedQuantity, userId);
      if (response.success && response.data) {
        set({ currentReservation: response.data, loading: false });
        return response.data;
      }
      return null;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create reservation', loading: false });
      return null;
    }
  },

  confirmReservation: async (reservationId, userId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.confirmReservation(reservationId, userId);
      if (response.success && response.data) {
        set({ currentReservation: response.data, loading: false });
        // Refresh user reservations
        await get().fetchUserReservations(userId);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to confirm reservation', loading: false });
      throw error;
    }
  },

  cancelReservation: async (reservationId, userId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.cancelReservation(reservationId, userId);
      if (response.success) {
        set({ loading: false });
        // Refresh user reservations
        await get().fetchUserReservations(userId);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to cancel reservation', loading: false });
      throw error;
    }
  },

  fetchUserReservations: async (userId, status) => {
    set({ loading: true, error: null });
    try {
      const response = await api.getUserReservations(userId, status);
      if (response.success && response.data) {
        set({ userReservations: response.data.reservations, loading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch reservations', loading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      selectedSection: null,
      selectedQuantity: 1,
      currentReservation: null,
      error: null,
    });
  },
}));

export default useReservationStore;