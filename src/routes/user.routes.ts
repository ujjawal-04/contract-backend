// src/routes/user.routes.ts
import express from 'express';
import { deleteAccount } from '../controllers/user.controller';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();

// Delete account route - requires authentication
router.delete('/delete-account', isAuthenticated, deleteAccount);

export default router;