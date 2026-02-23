import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { AuthUser, AuthUserPublic } from "../../types/auth/auth.types.js";
import type { UserPublicRow, UserRow } from "../../types/auth/auth-data.types.js";
import { mapAuthUser, mapAuthUserPublic } from "../../utils/auth/auth-user-mapper.util.js";

/**
 * 인증(로그인/회원가입) 정상 모드 서비스입니다.
 *
 * 정책:
 * - SQLi lab 비활성화 상태에서 사용하는 구현입니다.
 * - 모든 DB 접근은 안전한 바인딩 쿼리를 사용합니다.
 */

/**
 * username으로 사용자를 조회하는 안전 쿼리입니다(바인딩 사용).
 */
export async function findUserByUsername(username: string): Promise<AuthUser | null> {
    const rows = await sequelize.query<UserRow>(
        `
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
        WHERE username = :username
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { username } }
    );

    const row = rows[0];
    return row ? mapAuthUser(row) : null;
}

/**
 * 사용자 생성(안전 쿼리)입니다.
 * 바인딩 쿼리를 사용합니다.
 */
async function createUser(params: {
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
 * 사용자 생성(회원가입 컨텍스트)입니다.
 */
export async function createUserForRegister(params: {
    username: string;
    passwordHash: string;
}): Promise<AuthUserPublic> {
    const userRole: AuthUser["userRole"] = "user";
    const isActive = true;
    return createUser({ ...params, userRole, isActive });
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
                WHEN login_failed_count + 1 >= :maxFailures THEN true
                ELSE password_reset_required
            END,
            login_locked_until = CASE
                WHEN :useLoginLockUntil = true
                     AND login_failed_count + 1 >= :maxFailures
                THEN NOW() + make_interval(mins => :lockMinutes)
                ELSE login_locked_until
            END,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING
            login_failed_count,
            login_locked_until,
            password_reset_required
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                userId: params.userId,
                maxFailures: params.maxFailures,
                useLoginLockUntil: params.useLoginLockUntil,
                lockMinutes: params.lockMinutes,
            },
        }
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
        WHERE user_id = :userId
        `,
        {
            type: QueryTypes.UPDATE,
            replacements: { userId },
        }
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
        SET password_reset_token_hash = :tokenHash,
            password_reset_token_expires_at = :expiresAt,
            password_reset_requested_at = NOW(),
            password_reset_used_at = NULL,
            updated_at = NOW()
        WHERE user_id = :userId
        `,
        {
            type: QueryTypes.UPDATE,
            replacements: {
                userId: params.userId,
                tokenHash: params.tokenHash,
                expiresAt: params.expiresAt,
            },
        }
    );
}

export async function findValidPasswordResetTokenOwner(tokenHash: string): Promise<PasswordResetTokenOwner | null> {
    const rows = await sequelize.query<PasswordResetTokenOwnerRow>(
        `
        SELECT
            user_id,
            username
        FROM users
        WHERE password_reset_token_hash = :tokenHash
          AND password_reset_token_expires_at IS NOT NULL
          AND password_reset_token_expires_at > NOW()
          AND password_reset_used_at IS NULL
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { tokenHash },
        }
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
        SET password_hash = :passwordHash,
            password_reset_required = false,
            login_failed_count = 0,
            login_locked_until = NULL,
            password_reset_used_at = NOW(),
            password_reset_token_hash = NULL,
            password_reset_token_expires_at = NULL,
            updated_at = NOW()
        WHERE password_reset_token_hash = :tokenHash
          AND password_reset_token_expires_at IS NOT NULL
          AND password_reset_token_expires_at > NOW()
          AND password_reset_used_at IS NULL
        RETURNING user_id, username
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                tokenHash: params.tokenHash,
                passwordHash: params.passwordHash,
            },
        }
    );

    const row = rows[0];
    return row ? mapPasswordResetTokenOwner(row) : null;
}
