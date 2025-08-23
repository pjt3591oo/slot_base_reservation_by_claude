import { ReservationService } from '../services/reservationService';

export class ReservationScheduler {
  private reservationService: ReservationService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.reservationService = new ReservationService();
  }

  start(intervalMinutes: number = 1) {
    console.log(`Starting reservation expiry scheduler (interval: ${intervalMinutes} minutes)`);
    
    // Run immediately on start
    this.checkExpiredReservations();
    
    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.checkExpiredReservations();
    }, intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Reservation expiry scheduler stopped');
    }
  }

  private async checkExpiredReservations() {
    try {
      console.log('Checking for expired reservations...');
      const expiredCount = await this.reservationService.expireReservations();
      
      if (expiredCount > 0) {
        console.log(`Expired ${expiredCount} reservations`);
      }
    } catch (error) {
      console.error('Error checking expired reservations:', error);
    }
  }
}