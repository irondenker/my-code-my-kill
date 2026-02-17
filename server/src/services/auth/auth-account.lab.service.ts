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
            is_active
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
