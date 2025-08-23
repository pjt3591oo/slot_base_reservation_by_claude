import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index, JoinColumn } from 'typeorm';
import { User } from './User';
import { Section } from './Section';
import { ReservationLog } from './ReservationLog';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

@Entity('reservations')
@Index(['userId', 'status'])
@Index(['sectionId', 'status'])
@Index(['expiresAt'])
@Index(['createdAt'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  sectionId: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @ManyToOne(() => User, user => user.reservations)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Section, section => section.reservations)
  @JoinColumn({ name: 'sectionId' })
  section: Section;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING
  })
  status: ReservationStatus;

  @Column({ nullable: true })
  confirmationCode: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalPrice: number;

  @OneToMany(() => ReservationLog, log => log.reservation)
  logs: ReservationLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}