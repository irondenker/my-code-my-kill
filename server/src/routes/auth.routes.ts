import { Router } from 'express';
import {
  getLoginPage,
  getForgotPasswordPage,
  getRegisterPage,
  getResetPasswordPage,
  postLogin,
  postForgotPassword,
  postResetPassword,
  postRegister,
  postLogout,
} from '../controllers/auth.controller.js';

const router = Router();

router.get('/login', getLoginPage);
router.post('/login', postLogin);
router.get('/register', getRegisterPage);
router.post('/register', postRegister);
router.post('/logout', postLogout);
router.get('/forgot-password', getForgotPasswordPage);
router.post('/forgot-password', postForgotPassword);
router.get('/reset-password', getResetPasswordPage);
router.post('/reset-password', postResetPassword);

export default router;
