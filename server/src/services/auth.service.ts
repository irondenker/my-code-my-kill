/**
 * 인증(Auth) 서비스 배럴 파일입니다.
 *
 * 목적:
 * - 컨트롤러 import 경로를 단순화(`../services/auth.service.js`)합니다.
 * - 실제 구현은 `services/auth/` 하위로 위임합니다.
 */

export {
    findUserByUsername,
    findUserForLogin,
    findUserByUsernameForRegisterLookup,
    findUserByUsernameForAdminLookup,
    createUserForRegister,
    createUserForAdmin,
} from "./auth/auth-account.service.js";
