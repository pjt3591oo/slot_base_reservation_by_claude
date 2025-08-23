import { Request, Response } from 'express';
import { SectionService } from '../services/sectionService';
import { asyncHandler } from '../middlewares/asyncHandler';
import { AppError } from '../middlewares/errorHandler';

export class SectionController {
  private sectionService: SectionService;

  constructor() {
    this.sectionService = new SectionService();
  }

  getAvailableSections = asyncHandler(async (req: Request, res: Response) => {
    const sections = await this.sectionService.findAvailableSections();
    
    res.json({
      success: true,
      data: {
        sections,
        count: sections.length
      }
    });
  });

  getSectionById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const section = await this.sectionService.getSectionWithAvailability(id);
    
    if (!section) {
      throw new AppError('Section not found', 404);
    }
    
    res.json({
      success: true,
      data: section
    });
  });

  createSection = asyncHandler(async (req: Request, res: Response) => {
    const { name, description, totalCapacity, price, location } = req.body;
    
    if (!name || !totalCapacity) {
      throw new AppError('Name and total capacity are required', 400);
    }
    
    if (totalCapacity < 1) {
      throw new AppError('Total capacity must be at least 1', 400);
    }
    
    const section = await this.sectionService.createSection({
      name,
      description,
      totalCapacity,
      price,
      location
    });
    
    res.status(201).json({
      success: true,
      data: section
    });
  });

  getSectionStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.sectionService.getSectionStats();
    
    res.json({
      success: true,
      data: stats
    });
  });

  updateSectionStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      throw new AppError('Status is required', 400);
    }
    
    const updated = await this.sectionService.updateSectionStatus(id, status);
    
    if (!updated) {
      throw new AppError('Section not found', 404);
    }
    
    res.json({
      success: true,
      message: 'Section status updated successfully'
    });
  });
}