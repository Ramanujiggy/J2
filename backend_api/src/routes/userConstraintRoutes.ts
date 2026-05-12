import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  getUserConstraints,
  createUserConstraint,
  deleteUserConstraint,
} from '../controllers/userConstraintController.js';

const router = Router();
router.use(verifyToken);

router.get('/', getUserConstraints);
router.post('/', createUserConstraint);
router.delete('/:id', deleteUserConstraint);

export default router;
