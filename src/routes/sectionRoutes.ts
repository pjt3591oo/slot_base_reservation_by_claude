import { Router } from 'express';
import { SectionController } from '../controllers/sectionController';

const router = Router();
const sectionController = new SectionController();

router.get('/available', sectionController.getAvailableSections);
router.get('/stats', sectionController.getSectionStats);
router.get('/:id', sectionController.getSectionById);
router.post('/', sectionController.createSection);
router.patch('/:id/status', sectionController.updateSectionStatus);

export default router;