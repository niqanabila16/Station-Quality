import { Router } from "express";
import {
    getStationHistoryByCode,
    getAllStationHistory,
    getStationHistoryById,
    updateStationHistoryById,
    getResponseImageHistoryById
} from '../controllers/stasiunHistory.controller.js';

const router = Router();

// GET /api/station-history - Get all station history
router.get('/', getAllStationHistory);

// GET /api/station-history/bycode?code=XXX - Get station history by station code
router.get('/bycode', getStationHistoryByCode);

// GET /api/station-history/station/:id - Get station history by station ID
router.get('/station/:id', getStationHistoryById);

// PUT /api/station-history/station/:id - Get station history by station ID
router.put('/station/:id', updateStationHistoryById);

// GET /api/station-history/:history_id/response - Get response image by history ID
router.get('/:id/response', getResponseImageHistoryById);

export default router;