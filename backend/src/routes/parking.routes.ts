import { Router } from 'express';
import { getParkingPrediction } from '../controllers/parking.controller';

const router = Router();

router.get('/parking-prediction', getParkingPrediction);

export default router;
