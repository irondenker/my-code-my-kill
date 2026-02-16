import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import { runWithSqlInjectionTarget } from "../lab/sql-injection-control.service.js";
import type { AuthUser, AuthUserPublic } from "../../types/auth.types.js";
import type { UserPublicRow, UserRow } from "../../types/auth-account.types.js";
import { mapAuthUser, mapAuthUserPublic } from "../../utils/auth-user-mapper.util.js";
import { createUserSafe, findUserByUsernameSafe } from "./auth-account.normal.service.js";

/**
 * 인증(로그인/회원가입/어드민 유저 생성) lab 모드 서비스입니다.
 *
 * 책임:
 * - SQLi 실습 타깃(target) 기준으로 취약/안전 경로를 선택합니다.
 * - target이 비활성화된 기능은 정상(safe) 경로를 그대로 사용합니다.
 */

/**
 * username으로 사용자(AuthUser)를 안전한 바인딩 쿼리로 조회합니다.
 *
 * 주의: 이 함수는 SQLi 실습 타깃에 의해 취약 쿼리로 전환되지 않습니다.
 */
export async function findUserByUsername(username: string): Promise<AuthUser | null> {
    // 회원가입/어드민 생성 등에서 "중복 체크"로 호출되더라도,
    // 이 엔트리포인트는 항상 안전 쿼리로만 동작합니다(컨텍스트별 함수 사용 권장).
    return findUserByUsernameSafe(username);
}

/**
 * SQLi 실습용: username 조회를 안전하지 않은 문자열 보간 쿼리로 실행합니다.
 */
async function findUserByUsernameInsecureForLab(params: { username: string }): Promise<AuthUser | null> {
    // 주의: 의도적으로 문자열 보간을 사용합니다(SQLi 실습용).
    const query = `
        SELECT
            user_id,
            user_role,
            username,
            password_hash,
            is_active
        FROM users
        WHERE username = '${params.username}'
        LIMIT 1
    `;

    const rows = await sequelize.query<UserRow>(query, { type: QueryTypes.SELECT });
    const row = rows[0];
    return row ? mapAuthUser(row) : null;
}

/**
 * SQLi 실습용: INSERT를 안전하지 않은 문자열 보간 쿼리로 실행합니다.
 */
async function createUserInsecureForLab(params: {
    username: string;
    passwordHash: string;
    userRole: AuthUser["userRole"];
    isActive: boolean;
}): Promise<AuthUserPublic> {
    // 주의: 의도적으로 문자열 보간을 사용합니다(SQLi 실습용).
    const rows = await sequelize.query<UserPublicRow>(
        `
        INSERT INTO users (
            user_role,
            username,
            password_hash,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            '${params.userRole}',
            '${params.username}',
            '${params.passwordHash}',
            ${params.isActive ? "true" : "false"},
            NOW(),
            NOW()
        )
        RETURNING user_id, user_role, username, is_active
        `,
        { type: QueryTypes.SELECT }
    );

    const row = rows[0];
    if (!row) {
        throw new Error("Failed to create user");
    }

    return mapAuthUserPublic(row);
}

/**
 * 로그인용 사용자 조회입니다.
 * SQLi 실습 옵션이 켜져 있고 `targets.loginUsername`가 true면 취약 쿼리를 사용합니다.
 */
export async function findUserForLogin(params: { username: string }): Promise<AuthUser | null> {
    return runWithSqlInjectionTarget<AuthUser | null>({
        target: "loginUsername",
        insecure: () => findUserByUsernameInsecureForLab({ username: params.username }),
        safe: () => findUserByUsernameSafe(params.username),
    });
}

/**
 * 회원가입 화면에서 사용하는 username 중복 체크용 조회입니다.
 * SQLi 실습 옵션이 켜져 있고 `targets.registerUsernameLookup`가 true면 취약 쿼리를 사용합니다.
 */
export async function findUserByUsernameForRegisterLookup(username: string): Promise<AuthUser | null> {
    return runWithSqlInjectionTarget<AuthUser | null>({
        target: "registerUsernameLookup",
        insecure: () => findUserByUsernameInsecureForLab({ username }),
        safe: () => findUserByUsernameSafe(username),
    });
}

/**
 * 어드민 유저 생성 화면에서 사용하는 username 중복 체크용 조회입니다.
 * SQLi 실습 옵션이 켜져 있고 `targets.adminUserUsernameLookup`가 true면 취약 쿼리를 사용합니다.
 */
export async function findUserByUsernameForAdminLookup(username: string): Promise<AuthUser | null> {
    return runWithSqlInjectionTarget<AuthUser | null>({
        target: "adminUserUsernameLookup",
        insecure: () => findUserByUsernameInsecureForLab({ username }),
        safe: () => findUserByUsernameSafe(username),
    });
}

/**
 * 사용자 생성(회원가입 컨텍스트)입니다.
 * SQLi 실습 옵션이 켜져 있고 `targets.registerCreateUser`가 true면 취약 쿼리를 사용합니다.
 */
export async function createUserForRegister(params: {
    username: string;
    passwordHash: string;
}): Promise<AuthUserPublic> {
    const userRole: AuthUser["userRole"] = "user";
    const isActive = true;
    // 회원가입은 항상 기본 role/user + 활성 계정으로 생성합니다.
    return runWithSqlInjectionTarget<AuthUserPublic>({
        target: "registerCreateUser",
        insecure: () => createUserInsecureForLab({ ...params, userRole, isActive }),
        safe: () => createUserSafe({ ...params, userRole, isActive }),
    });
}

/**
 * 사용자 생성(어드민 컨텍스트)입니다.
 * SQLi 실습 옵션이 켜져 있고 `targets.adminUserCreate`가 true면 취약 쿼리를 사용합니다.
 */
export async function createUserForAdmin(params: {
    username: string;
    passwordHash: string;
    userRole: AuthUser["userRole"];
    isActive: boolean;
}): Promise<AuthUserPublic> {
    // 어드민 컨텍스트는 role/활성 여부를 UI 입력값으로 결정합니다.
    return runWithSqlInjectionTarget<AuthUserPublic>({
        target: "adminUserCreate",
        insecure: () => createUserInsecureForLab(params),
        safe: () => createUserSafe(params),
    });
}
