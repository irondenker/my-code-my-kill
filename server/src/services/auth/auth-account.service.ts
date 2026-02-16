import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./auth-account.lab.service.js";
import * as normalImplementation from "./auth-account.normal.service.js";
import type { AuthUser, AuthUserPublic } from "../../types/auth.types.js";

/**
 * 인증 계정 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `auth-account.lab.service`를 사용합니다.
 * - 그 외 기능은 `auth-account.normal.service`를 사용합니다.
 */

/**
 * username으로 사용자를 조회합니다.
 * SQLi username 조회 타깃이 하나라도 활성화된 경우 lab 경로를 사용합니다.
 */
export async function findUserByUsername(username: string): Promise<AuthUser | null> {
    if (isSqlInjectionTargetEnabled("usernameLookup")) {
        return labImplementation.findUserByUsername(username);
    }
    return normalImplementation.findUserByUsername(username);
}

/**
 * 회원가입 컨텍스트 사용자 생성입니다.
 */
export async function createUserForRegister(params: {
    username: string;
    passwordHash: string;
}): Promise<AuthUserPublic> {
    if (isSqlInjectionTargetEnabled("registerCreateUser")) {
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
    if (isSqlInjectionTargetEnabled("adminUserCreate")) {
        return labImplementation.createUserForAdmin(params);
    }
    return normalImplementation.createUserForAdmin(params);
}
