import { AppDataSource } from '../src/config/database';
import { User } from '../src/entities/User';

async function seedGuestUser() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connected');

    const userRepository = AppDataSource.getRepository(User);

    // Check if guest user already exists
    const existingUser = await userRepository.findOne({
      where: { id: '550e8400-e29b-41d4-a716-446655440000' }
    });

    if (existingUser) {
      console.log('Guest user already exists');
      return;
    }

    // Create guest user
    const guestUser = userRepository.create({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'guest@example.com',
      name: '게스트',
      phoneNumber: '010-0000-0000'
    });

    await userRepository.save(guestUser);
    console.log('Guest user created successfully!');

  } catch (error) {
    console.error('Error creating guest user:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run the seed function
seedGuestUser();