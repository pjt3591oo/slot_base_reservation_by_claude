import { Request, Response } from 'express';
import { ReservationService } from '../services/reservationService';
import { SlotReservationService } from '../services/slotReservationService';
import { asyncHandler } from '../middlewares/asyncHandler';
import { AppError } from '../middlewares/errorHandler';
import { features } from '../config/features';

interface AuthRequest extends Request {
  userId?: string;
}

export class ReservationController {
  private reservationService: ReservationService | SlotReservationService;

  constructor() {
    // Use slot-based service if feature flag is enabled
    this.reservationService = features.useSlotBasedReservation 
      ? new SlotReservationService() 
      : new ReservationService();
    
    if (features.useSlotBasedReservation) {
      console.log('🎰 Using slot-based reservation system');
    } else {
      console.log('🔒 Using traditional lock-based reservation system');
    }
  }

  createReservation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sectionId, quantity } = req.body;
    const userId = req.userId || req.body.userId; // For testing purposes
    
    if (!sectionId) {
      throw new AppError('Section ID is required', 400);
    }
    
    if (!quantity || quantity < 1) {
      throw new AppError('Valid quantity is required (minimum 1)', 400);
    }
    
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    const reservation = await this.reservationService.createReservation(userId, sectionId, quantity);
    
    res.status(201).json({
      success: true,
      data: reservation
    });
  });

  confirmReservation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.userId || req.body.userId;
    
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    const reservation = await this.reservationService.confirmReservation(id, userId);
    
    res.json({
      success: true,
      data: reservation
    });
  });

  cancelReservation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.userId || req.body.userId;
    
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    const reservation = await this.reservationService.cancelReservation(id, userId);
    
    res.json({
      success: true,
      data: reservation
    });
  });

  getReservation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.userId || req.query.userId as string;
    
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    const reservation = await this.reservationService.getReservationById(id, userId);
    
    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }
    
    res.json({
      success: true,
      data: reservation
    });
  });

  getUserReservations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.query.userId as string;
    const { status } = req.query;
    
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    const reservations = await this.reservationService.getUserReservations(userId, status as any);
    
    res.json({
      success: true,
      data: {
        reservations,
        count: reservations.length
      }
    });
  });

  getReservationStats = asyncHandler(async (req: Request, res: Response) => {
    const { sectionId } = req.query;
    
    const stats = await this.reservationService.getReservationStats(sectionId as string);
    
    res.json({
      success: true,
      data: stats
    });
  });
}