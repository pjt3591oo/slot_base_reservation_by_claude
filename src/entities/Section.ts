import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Reservation } from './Reservation';

export enum SectionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  MAINTENANCE = 'maintenance'
}

@Entity('sections')
@Index(['status'])
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'int' })
  totalCapacity: number;

  @Column({ type: 'int', default: 0 })
  currentOccupancy: number;

  @Column({
    type: 'enum',
    enum: SectionStatus,
    default: SectionStatus.OPEN
  })
  status: SectionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ nullable: true })
  location: string;

  @OneToMany(() => Reservation, reservation => reservation.section)
  reservations: Reservation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get availableSeats(): number {
    return this.totalCapacity - this.currentOccupancy;
  }
}