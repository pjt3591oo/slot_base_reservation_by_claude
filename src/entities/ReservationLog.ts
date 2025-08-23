import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index, JoinColumn } from 'typeorm';
import { Reservation } from './Reservation';

export enum ReservationAction {
  CREATED = 'created',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  EXTENDED = 'extended'
}

@Entity('reservation_logs')
@Index(['reservationId'])
@Index(['action'])
@Index(['createdAt'])
export class ReservationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reservationId: string;

  @ManyToOne(() => Reservation, reservation => reservation.logs)
  @JoinColumn({ name: 'reservationId' })
  reservation: Reservation;

  @Column({
    type: 'enum',
    enum: ReservationAction
  })
  action: ReservationAction;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  performedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}