import type { AuthUser, AuthUserPublic } from "../types/auth.types.js";
import type { UserPublicRow, UserRow } from "../types/auth-data.types.js";

/**
 * DB 조회 결과(UserRow)를 애플리케이션 타입(AuthUser)으로 매핑합니다.
 */
export function mapAuthUser(row: UserRow): AuthUser {
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
 */
export function mapAuthUserPublic(row: UserPublicRow): AuthUserPublic {
    return {
        userId: Number(row.user_id),
        userRole: row.user_role as AuthUser["userRole"],
        username: row.username,
        isActive: Boolean(row.is_active),
    };
}
