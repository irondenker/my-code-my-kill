import { Router } from 'express';
import { getBoardBySlug, getBoardIndex } from '../controllers/board.controller.js';
import {
  deleteArticle,
  getArticleCreateForm,
  getArticleEditForm,
  getArticleShow,
  postArticleCreate,
  postArticleEdit,
} from '../controllers/article.controller.js';
import { requireAuth, requireAuthRedirect } from '../middlewares/auth.middleware.js';
import { enforcePostMutationRateLimit } from '../middlewares/security-defense-rate-limit.middleware.js';

const router = Router();

router.get('/board/:slug/new', requireAuthRedirect, getArticleCreateForm);
router.post('/board/:slug', requireAuthRedirect, enforcePostMutationRateLimit, postArticleCreate);
router.get('/board/:slug/:displayId/edit', requireAuthRedirect, getArticleEditForm);
router.post(
  '/board/:slug/:displayId/edit',
  requireAuthRedirect,
  enforcePostMutationRateLimit,
  postArticleEdit
);
router.post(
  '/board/:slug/:displayId/delete',
  requireAuthRedirect,
  enforcePostMutationRateLimit,
  deleteArticle
);
router.get('/board/:slug/:displayId', getArticleShow);
router.delete('/board/:slug/:displayId', requireAuth, enforcePostMutationRateLimit, deleteArticle);
router.get('/board/:slug', getBoardBySlug);
router.get('/board', getBoardIndex);

export default router;
