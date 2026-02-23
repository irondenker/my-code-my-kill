import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { AuthUser, AuthUserPublic } from "../../types/auth/auth.types.js";
import type { UserPublicRow, UserRow } from "../../types/auth/auth-data.types.js";
import { mapAuthUser, mapAuthUserPublic } from "../../utils/auth/auth-user-mapper.util.js";

/**
 * 인증(로그인/회원가입) lab 모드 서비스입니다.
 *
 * 책임:
 * - facade가 lab 경로로 라우팅한 기능을 취약 쿼리로 실행합니다.
 * - 타깃 활성 여부 판정은 facade(`auth-account.service.ts`)에서 담당합니다.
 */

/**
 * username으로 사용자(AuthUser)를 조회합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function findUserByUsername(username: string): Promise<AuthUser | null> {
    // 주의: 의도적으로 문자열 보간을 사용합니다(SQLi 실습용).
    const query = `
        SELECT
            user_id,
            user_role,
            username,
            password_hash,
            is_active,
            login_failed_count,
            login_locked_until,
            password_reset_required,
            password_reset_token_hash,
            password_reset_token_expires_at,
            password_reset_requested_at,
            password_reset_used_at
        FROM users
        WHERE username = '${username}'
        LIMIT 1
    `;

    const rows = await sequelize.query<UserRow>(query, { type: QueryTypes.SELECT });
    const row = rows[0];
    return row ? mapAuthUser(row) : null;
}

/**
 * 사용자 생성(회원가입 컨텍스트)입니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function createUserForRegister(params: {
    username: string;
    passwordHash: string;
}): Promise<AuthUserPublic> {
    const userRole: AuthUser["userRole"] = "user";
    const isActive = true;
    // 회원가입은 항상 기본 role/user + 활성 계정으로 생성합니다.
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
            '${userRole}',
            '${params.username}',
            '${params.passwordHash}',
            ${isActive ? "true" : "false"},
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

export type LoginDefenseState = {
    loginFailedCount: number;
    loginLockedUntil: Date | null;
    passwordResetRequired: boolean;
};

type LoginDefenseStateRow = {
    login_failed_count: number;
    login_locked_until: Date | null;
    password_reset_required: boolean;
};

type PasswordResetTokenOwnerRow = {
    user_id: number;
    username: string;
};

export type PasswordResetTokenOwner = {
    userId: number;
    username: string;
};

function mapLoginDefenseState(row: LoginDefenseStateRow): LoginDefenseState {
    return {
        loginFailedCount: Number(row.login_failed_count),
        loginLockedUntil: row.login_locked_until ? new Date(row.login_locked_until) : null,
        passwordResetRequired: Boolean(row.password_reset_required),
    };
}

export async function recordLoginFailureAndRequirePasswordReset(params: {
    userId: number;
    maxFailures: number;
    useLoginLockUntil: boolean;
    lockMinutes: number;
}): Promise<LoginDefenseState> {
    const rows = await sequelize.query<LoginDefenseStateRow>(
        `
        UPDATE users
        SET login_failed_count = login_failed_count + 1,
            password_reset_required = CASE
                WHEN login_failed_count + 1 >= ${params.maxFailures} THEN true
                ELSE password_reset_required
            END,
            login_locked_until = CASE
                WHEN ${params.useLoginLockUntil ? "true" : "false"} = true
                     AND login_failed_count + 1 >= ${params.maxFailures}
                THEN NOW() + make_interval(mins => ${params.lockMinutes})
                ELSE login_locked_until
            END,
            updated_at = NOW()
        WHERE user_id = ${params.userId}
        RETURNING
            login_failed_count,
            login_locked_until,
            password_reset_required
        `,
        { type: QueryTypes.SELECT }
    );

    const row = rows[0];
    if (!row) {
        throw new Error("Failed to update login defense state");
    }

    return mapLoginDefenseState(row);
}

export async function resetLoginFailureState(userId: number): Promise<void> {
    await sequelize.query(
        `
        UPDATE users
        SET login_failed_count = 0,
            login_locked_until = NULL,
            updated_at = NOW()
        WHERE user_id = ${userId}
        `,
        { type: QueryTypes.UPDATE }
    );
}

function mapPasswordResetTokenOwner(row: PasswordResetTokenOwnerRow): PasswordResetTokenOwner {
    return {
        userId: Number(row.user_id),
        username: row.username,
    };
}

export async function savePasswordResetToken(params: {
    userId: number;
    tokenHash: string;
    expiresAt: Date;
}): Promise<void> {
    await sequelize.query(
        `
        UPDATE users
        SET password_reset_token_hash = '${params.tokenHash}',
            password_reset_token_expires_at = '${params.expiresAt.toISOString()}',
            password_reset_requested_at = NOW(),
            password_reset_used_at = NULL,
            updated_at = NOW()
        WHERE user_id = ${params.userId}
        `,
        { type: QueryTypes.UPDATE }
    );
}

export async function findValidPasswordResetTokenOwner(tokenHash: string): Promise<PasswordResetTokenOwner | null> {
    const rows = await sequelize.query<PasswordResetTokenOwnerRow>(
        `
        SELECT
            user_id,
            username
        FROM users
        WHERE password_reset_token_hash = '${tokenHash}'
          AND password_reset_token_expires_at IS NOT NULL
          AND password_reset_token_expires_at > NOW()
          AND password_reset_used_at IS NULL
        LIMIT 1
        `,
        { type: QueryTypes.SELECT }
    );

    const row = rows[0];
    return row ? mapPasswordResetTokenOwner(row) : null;
}

export async function completePasswordResetByTokenHash(params: {
    tokenHash: string;
    passwordHash: string;
}): Promise<PasswordResetTokenOwner | null> {
    const rows = await sequelize.query<PasswordResetTokenOwnerRow>(
        `
        UPDATE users
        SET password_hash = '${params.passwordHash}',
            password_reset_required = false,
            login_failed_count = 0,
            login_locked_until = NULL,
            password_reset_used_at = NOW(),
            password_reset_token_hash = NULL,
            password_reset_token_expires_at = NULL,
            updated_at = NOW()
        WHERE password_reset_token_hash = '${params.tokenHash}'
          AND password_reset_token_expires_at IS NOT NULL
          AND password_reset_token_expires_at > NOW()
          AND password_reset_used_at IS NULL
        RETURNING user_id, username
        `,
        { type: QueryTypes.SELECT }
    );

    const row = rows[0];
    return row ? mapPasswordResetTokenOwner(row) : null;
}
