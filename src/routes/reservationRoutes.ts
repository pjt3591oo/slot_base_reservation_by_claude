import { Router } from 'express';
import { ReservationController } from '../controllers/reservationController';

const router = Router();
const reservationController = new ReservationController();

router.post('/', reservationController.createReservation);
router.post('/:id/confirm', reservationController.confirmReservation);
router.post('/:id/cancel', reservationController.cancelReservation);
router.get('/user', reservationController.getUserReservations);
router.get('/stats', reservationController.getReservationStats);
router.get('/:id', reservationController.getReservation);

export default router;