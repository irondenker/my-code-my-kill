import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { AuthUser, AuthUserPublic } from "../../types/auth.types.js";
import type { UserPublicRow, UserRow } from "../../types/auth-data.types.js";
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
