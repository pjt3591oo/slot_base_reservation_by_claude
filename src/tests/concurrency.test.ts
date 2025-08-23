import { AppDataSource } from '../config/database';
import { ReservationService } from '../services/reservationService';
import { SectionService } from '../services/sectionService';
import { Section, SectionStatus } from '../entities/Section';
import { User } from '../entities/User';
import { SeatCounter } from '../utils/seatCounter';

describe('Concurrency Tests for Free Seating System', () => {
  let reservationService: ReservationService;
  let sectionService: SectionService;
  let testSection: Section;
  let testUsers: User[];

  beforeAll(async () => {
    await AppDataSource.initialize();
    reservationService = new ReservationService();
    sectionService = new SectionService();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  beforeEach(async () => {
    // Create test section
    testSection = await sectionService.createSection({
      name: 'Test Section',
      totalCapacity: 100,
      currentOccupancy: 0,
      status: SectionStatus.OPEN,
      price: 50000
    });

    // Create test users
    const userRepo = AppDataSource.getRepository(User);
    testUsers = await userRepo.save([
      { email: 'user1@test.com', name: 'User 1' },
      { email: 'user2@test.com', name: 'User 2' },
      { email: 'user3@test.com', name: 'User 3' },
      { email: 'user4@test.com', name: 'User 4' },
      { email: 'user5@test.com', name: 'User 5' }
    ]);
  });

  afterEach(async () => {
    // Clean up
    await AppDataSource.createQueryBuilder()
      .delete()
      .from('reservation_logs')
      .execute();
    
    await AppDataSource.createQueryBuilder()
      .delete()
      .from('reservations')
      .execute();
    
    await AppDataSource.createQueryBuilder()
      .delete()
      .from('sections')
      .execute();
    
    await AppDataSource.createQueryBuilder()
      .delete()
      .from('users')
      .execute();

    // Clean Redis
    await SeatCounter.removeSection(testSection.id);
  });

  test('Should prevent overbooking when multiple users reserve simultaneously', async () => {
    // Try to reserve 30 seats each by 5 users (total 150 seats)
    // But section only has 100 seats
    const promises = testUsers.map(user => 
      reservationService.createReservation(user.id, testSection.id, 30)
        .catch(err => ({ error: err.message }))
    );

    const results = await Promise.all(promises);
    
    const successfulReservations = results.filter(r => !r.error);
    const failedReservations = results.filter(r => r.error);

    // Calculate total reserved seats
    const totalReservedSeats = successfulReservations.reduce((sum, r) => sum + (r.quantity || 0), 0);

    expect(totalReservedSeats).toBeLessThanOrEqual(100);
    expect(failedReservations.length).toBeGreaterThan(0);
  });

  test('Should handle concurrent reservations with different quantities correctly', async () => {
    const reservationAttempts = [
      { userId: testUsers[0].id, quantity: 50 },
      { userId: testUsers[1].id, quantity: 30 },
      { userId: testUsers[2].id, quantity: 40 },
      { userId: testUsers[3].id, quantity: 20 },
      { userId: testUsers[4].id, quantity: 10 }
    ];

    const promises = reservationAttempts.map(attempt => 
      reservationService.createReservation(attempt.userId, testSection.id, attempt.quantity)
        .catch(err => ({ error: err.message, quantity: attempt.quantity }))
    );

    const results = await Promise.all(promises);
    
    const successfulReservations = results.filter(r => !r.error);
    const totalReservedSeats = successfulReservations.reduce((sum, r) => sum + (r.quantity || 0), 0);

    expect(totalReservedSeats).toBeLessThanOrEqual(100);

    // Verify Redis counter
    const availableInRedis = await SeatCounter.getAvailableSeats(testSection.id);
    expect(availableInRedis).toBe(100 - totalReservedSeats);

    // Verify database state
    const sectionInDb = await sectionService.findSectionById(testSection.id);
    expect(sectionInDb?.currentOccupancy).toBe(totalReservedSeats);
  });

  test('Should maintain consistency between Redis and database under concurrent load', async () => {
    // Create many small concurrent reservations
    const reservationPromises = [];
    
    for (let i = 0; i < 50; i++) {
      const userIndex = i % testUsers.length;
      const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 seats
      
      reservationPromises.push(
        reservationService.createReservation(testUsers[userIndex].id, testSection.id, quantity)
          .catch(err => ({ error: err.message }))
      );
    }

    await Promise.all(reservationPromises);

    // Check consistency
    const sectionInDb = await sectionService.findSectionById(testSection.id);
    const availableInRedis = await SeatCounter.getAvailableSeats(testSection.id);
    
    expect(sectionInDb!.totalCapacity - sectionInDb!.currentOccupancy).toBe(availableInRedis);
  });

  test('Should handle race condition between reservation and cancellation', async () => {
    // First create a reservation
    const reservation = await reservationService.createReservation(
      testUsers[0].id, 
      testSection.id, 
      20
    );

    // Try to cancel and create new reservations simultaneously
    const promises = [
      reservationService.cancelReservation(reservation.id, testUsers[0].id),
      reservationService.createReservation(testUsers[1].id, testSection.id, 30),
      reservationService.createReservation(testUsers[2].id, testSection.id, 40),
      reservationService.createReservation(testUsers[3].id, testSection.id, 50)
    ];

    const results = await Promise.all(promises.map(p => p.catch(e => ({ error: e.message }))));

    // Verify final state
    const sectionInDb = await sectionService.findSectionById(testSection.id);
    const availableInRedis = await SeatCounter.getAvailableSeats(testSection.id);
    
    expect(sectionInDb!.totalCapacity - sectionInDb!.currentOccupancy).toBe(availableInRedis);
    expect(sectionInDb!.currentOccupancy).toBeLessThanOrEqual(100);
  });

  test('Should correctly handle expired reservations cleanup', async () => {
    // Create some reservations
    const reservations = await Promise.all([
      reservationService.createReservation(testUsers[0].id, testSection.id, 20),
      reservationService.createReservation(testUsers[1].id, testSection.id, 30),
      reservationService.createReservation(testUsers[2].id, testSection.id, 25)
    ]);

    // Manually expire them
    await AppDataSource.createQueryBuilder()
      .update('reservations')
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();

    // Run expiration process
    const expiredCount = await reservationService.expireReservations();
    
    expect(expiredCount).toBe(3);

    // Verify seats are released
    const sectionInDb = await sectionService.findSectionById(testSection.id);
    const availableInRedis = await SeatCounter.getAvailableSeats(testSection.id);
    
    expect(sectionInDb!.currentOccupancy).toBe(0);
    expect(availableInRedis).toBe(100);
  });
});