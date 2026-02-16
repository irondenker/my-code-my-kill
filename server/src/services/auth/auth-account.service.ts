import { isSqlInjectionLabEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./auth-account.lab.service.js";
import * as normalImplementation from "./auth-account.normal.service.js";
import type { AuthUser, AuthUserPublic } from "../../types/auth.types.js";

/**
 * 인증 계정 서비스 facade입니다.
 *
 * 모드:
 * - SQLi lab 활성화: `auth-account.lab.service`
 * - SQLi lab 비활성화: `auth-account.normal.service`
 *
 * 참고:
 * - 모드 선택은 모듈 로드 시 1회 결정됩니다(프로세스 재시작 전까지 고정).
 */

// 시작 시점의 lab 토글 값을 기준으로 구현체를 선택합니다.
const useLabImplementation = isSqlInjectionLabEnabled();

/**
 * username으로 사용자를 조회합니다.
 * (항상 safe 조회이며, 모드에 따라 내부 구현체만 달라집니다.)
 */
export async function findUserByUsername(username: string): Promise<AuthUser | null> {
    if (useLabImplementation) {
        return labImplementation.findUserByUsername(username);
    }
    return normalImplementation.findUserByUsername(username);
}

/**
 * 로그인 컨텍스트 사용자 조회입니다.
 */
export async function findUserForLogin(params: { username: string }): Promise<AuthUser | null> {
    if (useLabImplementation) {
        return labImplementation.findUserForLogin(params);
    }
    return normalImplementation.findUserForLogin(params);
}

/**
 * 회원가입 화면 username 중복 체크용 조회입니다.
 */
export async function findUserByUsernameForRegisterLookup(username: string): Promise<AuthUser | null> {
    if (useLabImplementation) {
        return labImplementation.findUserByUsernameForRegisterLookup(username);
    }
    return normalImplementation.findUserByUsernameForRegisterLookup(username);
}

/**
 * 어드민 유저 생성 화면 username 중복 체크용 조회입니다.
 */
export async function findUserByUsernameForAdminLookup(username: string): Promise<AuthUser | null> {
    if (useLabImplementation) {
        return labImplementation.findUserByUsernameForAdminLookup(username);
    }
    return normalImplementation.findUserByUsernameForAdminLookup(username);
}

/**
 * 회원가입 컨텍스트 사용자 생성입니다.
 */
export async function createUserForRegister(params: {
    username: string;
    passwordHash: string;
}): Promise<AuthUserPublic> {
    if (useLabImplementation) {
        return labImplementation.createUserForRegister(params);
    }
    return normalImplementation.createUserForRegister(params);
}

/**
 * 어드민 컨텍스트 사용자 생성입니다.
 */
export async function createUserForAdmin(params: {
    username: string;
    passwordHash: string;
    userRole: AuthUser["userRole"];
    isActive: boolean;
}): Promise<AuthUserPublic> {
    if (useLabImplementation) {
        return labImplementation.createUserForAdmin(params);
    }
    return normalImplementation.createUserForAdmin(params);
}
