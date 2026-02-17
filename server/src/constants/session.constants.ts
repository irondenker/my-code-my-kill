/**
 * 세션/쿠키 공통 상수입니다.
 *
 * 원칙:
 * - 쿠키명 같은 인프라 상수는 단일 소스로 관리해 drift를 방지합니다.
 */

/** express-session이 사용하는 세션 쿠키 이름입니다. */
export const SESSION_COOKIE_NAME = "mcmk.sid";
