/**
 * Auth 컨트롤러 배럴 파일입니다.
 *
 * 분할 원칙:
 * - 유즈케이스(페이지/로그인/회원가입/로그아웃) 단위로 컨트롤러를 분리합니다.
 * - 라우트 import 경로 호환성을 위해 기존 경로(`controllers/auth.controller`)에서 재노출합니다.
 */

export { getLoginPage, getRegisterPage } from "./auth/auth-pages.controller.js";
export { postRegister } from "./auth/auth-register.controller.js";
export { postLogin } from "./auth/auth-login.controller.js";
export { postLogout } from "./auth/auth-logout.controller.js";
export {
    getForgotPasswordPage,
    postForgotPassword,
    getResetPasswordPage,
    postResetPassword,
} from "./auth/auth-password-reset.controller.js";
