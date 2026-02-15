import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import { getLabOptions } from "../../config/lab-options.js";
import type { AuthUser, AuthUserPublic } from "../../types/auth.types.js";
import { runWithSqlInjectionOption } from "../../utils/sql-injection.util.js";

/**
 * 인증(로그인/회원가입/어드민 유저 생성)에 필요한 핵심 DB 쿼리를 제공합니다.
 *
 * 원칙:
 * - 컨트롤러는 `req/res/session` 같은 I/O만 담당합니다.
 * - 이 서비스는 DB 접근 및(실습 옵션에 따른) 취약/안전 쿼리 분기를 담당합니다.
 */
const sqlInjectionOptions = getLabOptions().sqlInjection;

type UserRow = {
    user_id: number;
    user_role: string;
    username: string;
    password_hash: string;
    is_active: boolean;
};

type UserPublicRow = {
    user_id: number;
    user_role: string;
    username: string;
    is_active: boolean;
};

/**
 * auth-core에서 사용하는 SQLi 분기 헬퍼입니다.
 * 공통 유틸의 `runWithSqlInjectionOption`에 전역 옵션을 함께 전달합니다.
 */
async function runWithAuthSqlInjectionOption<T>(params: {
    targetEnabled: boolean;
    insecure: () => Promise<T>;
    safe: () => Promise<T>;
}): Promise<T> {
    return runWithSqlInjectionOption<T>({
        sqlInjectionOptions,
        targetEnabled: params.targetEnabled,
        insecure: params.insecure,
        safe: params.safe,
    });
}

/**
 * DB 조회 결과(UserRow)를 애플리케이션 타입(AuthUser)으로 매핑합니다.
 *
 * @param row DB 행
 */
function mapAuthUser(row: UserRow): AuthUser {
    return {
        userId: Number(row.user_id),
        userRole: row.user_role as AuthUser["userRole"],
        username: row.username,
        passwordHash: row.password_hash,
        isActive: Boolean(row.is_active),
    };
}

/**
 * DB 조회 결과(UserPublicRow)를 애플리케이션 타입(AuthUserPublic)으로 매핑합니다.
 *
 * @param row DB 행
 */
function mapAuthUserPublic(row: UserPublicRow): AuthUserPublic {
    return {
        userId: Number(row.user_id),
        userRole: row.user_role as AuthUser["userRole"],
        username: row.username,
        isActive: Boolean(row.is_active),
    };
}

/**
 * SQLi 실습용: username 조회를 안전하지 않은 문자열 보간 쿼리로 실행합니다.
 *
 * @param params username
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
 * username으로 사용자를 조회하는 안전 쿼리입니다(바인딩 사용).
 *
 * @param username username
 */
async function findUserByUsernameSafe(username: string): Promise<AuthUser | null> {
    const rows = await sequelize.query<UserRow>(
        `
        SELECT
            user_id,
            user_role,
            username,
            password_hash,
            is_active
        FROM users
        WHERE username = :username
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { username } }
    );

    const row = rows[0];
    return row ? mapAuthUser(row) : null;
}

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
 * 로그인용 사용자 조회입니다.
 * SQLi 실습 옵션이 켜져 있고 `targets.loginUsername`가 true면 취약 쿼리를 사용합니다.
 */
export async function findUserForLogin(params: { username: string }): Promise<AuthUser | null> {
    return runWithAuthSqlInjectionOption<AuthUser | null>({
        targetEnabled: sqlInjectionOptions.targets.loginUsername,
        insecure: () => findUserByUsernameInsecureForLab({ username: params.username }),
        safe: () => findUserByUsernameSafe(params.username),
    });
}

/**
 * 회원가입 화면에서 사용하는 username 중복 체크용 조회입니다.
 * SQLi 실습 옵션이 켜져 있고 `targets.registerUsernameLookup`가 true면 취약 쿼리를 사용합니다.
 */
export async function findUserByUsernameForRegisterLookup(username: string): Promise<AuthUser | null> {
    return runWithAuthSqlInjectionOption<AuthUser | null>({
        targetEnabled: sqlInjectionOptions.targets.registerUsernameLookup,
        insecure: () => findUserByUsernameInsecureForLab({ username }),
        safe: () => findUserByUsernameSafe(username),
    });
}

/**
 * 어드민 유저 생성 화면에서 사용하는 username 중복 체크용 조회입니다.
 * SQLi 실습 옵션이 켜져 있고 `targets.adminUserUsernameLookup`가 true면 취약 쿼리를 사용합니다.
 */
export async function findUserByUsernameForAdminLookup(username: string): Promise<AuthUser | null> {
    return runWithAuthSqlInjectionOption<AuthUser | null>({
        targetEnabled: sqlInjectionOptions.targets.adminUserUsernameLookup,
        insecure: () => findUserByUsernameInsecureForLab({ username }),
        safe: () => findUserByUsernameSafe(username),
    });
}

/**
 * 사용자 생성(안전 쿼리)입니다.
 * 바인딩 쿼리를 사용합니다.
 */
async function createUserSafe(params: {
    username: string;
    passwordHash: string;
    userRole: AuthUser["userRole"];
    isActive: boolean;
}): Promise<AuthUserPublic> {
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
            :userRole,
            :username,
            :passwordHash,
            :isActive,
            NOW(),
            NOW()
        )
        RETURNING user_id, user_role, username, is_active
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                userRole: params.userRole,
                username: params.username,
                passwordHash: params.passwordHash,
                isActive: params.isActive,
            },
        }
    );

    const row = rows[0];
    if (!row) {
        throw new Error("Failed to create user");
    }

    return mapAuthUserPublic(row);
}

/**
 * SQLi 실습용: INSERT를 안전하지 않은 문자열 보간 쿼리로 실행합니다.
 *
 * @param params 생성 파라미터
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
    return runWithAuthSqlInjectionOption<AuthUserPublic>({
        targetEnabled: sqlInjectionOptions.targets.registerCreateUser,
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
    return runWithAuthSqlInjectionOption<AuthUserPublic>({
        targetEnabled: sqlInjectionOptions.targets.adminUserCreate,
        insecure: () => createUserInsecureForLab(params),
        safe: () => createUserSafe(params),
    });
}
