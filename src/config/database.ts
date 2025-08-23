import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Section } from '../entities/Section';
import { Reservation } from '../entities/Reservation';
import { User } from '../entities/User';
import { ReservationLog } from '../entities/ReservationLog';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'seat_reservation',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [Section, Reservation, User, ReservationLog],
  migrations: [],
  subscribers: [],
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
});