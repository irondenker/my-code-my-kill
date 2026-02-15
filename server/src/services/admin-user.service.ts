import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";
import type { AdminUserMeta, AdminUserSummary, DeleteUserForAdminResult } from "../types/auth.types.js";

/**
 * 어드민 유저 관리(목록/메타/상태/역할/삭제)에 필요한 DB 쿼리 모음입니다.
 *
 * 책임:
 * - 사용자 목록/메타/상태/역할/삭제 관련 DB 접근
 *
 * 반대 책임(여기서 하지 않음):
 * - 정책 판정(예: admin 최소 1명 유지)은 유틸/컨트롤러에서 결정 후 이 서비스를 호출합니다.
 */

/**
 * 어드민 유저 목록을 조회합니다.
 *
 * @returns 어드민 화면에서 사용하는 요약 리스트
 */
export async function listUsersForAdmin(): Promise<AdminUserSummary[]> {
    const rows = await sequelize.query<{
        user_id: number;
        username: string;
        user_role: string;
        is_active: boolean;
        created_at: Date;
    }>(
        `
        SELECT
            user_id,
            username,
            user_role,
            is_active,
            created_at
        FROM users
        ORDER BY user_id ASC
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.map((row) => ({
        userId: Number(row.user_id),
        username: row.username,
        userRole: row.user_role as AdminUserSummary["userRole"],
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
    }));
}

/**
 * 사용자 활성/비활성 상태를 변경합니다.
 *
 * @param params 변경 파라미터
 */
export async function updateUserActiveStatus(params: { userId: number; isActive: boolean }): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET is_active = :isActive,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT, replacements: { userId: params.userId, isActive: params.isActive } }
    );

    return rows.length > 0;
}

/**
 * 어드민 정책/화면용 사용자 최소 메타 정보를 조회합니다.
 *
 * @param userId 대상 사용자 ID
 */
export async function findUserMetaForAdminById(userId: number): Promise<AdminUserMeta | null> {
    const rows = await sequelize.query<{
        user_id: number;
        username: string;
        user_role: string;
        is_active: boolean;
    }>(
        `
        SELECT
            user_id,
            username,
            user_role,
            is_active
        FROM users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { userId } }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return {
        userId: Number(row.user_id),
        username: row.username,
        userRole: row.user_role as AdminUserMeta["userRole"],
        isActive: Boolean(row.is_active),
    };
}

/**
 * admin 역할을 가진 사용자 수를 반환합니다.
 * (최소 1명 admin 유지 정책 등에 사용)
 */
export async function countAdminUsers(): Promise<number> {
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM users
        WHERE user_role = 'admin'
        `,
        { type: QueryTypes.SELECT }
    );

    return Number(rows[0]?.total_count ?? 0);
}

/**
 * 사용자 역할(user/admin)을 변경합니다.
 *
 * @param params 변경 파라미터
 */
export async function updateUserRole(params: { userId: number; userRole: "admin" | "user" }): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET user_role = :userRole,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT, replacements: { userId: params.userId, userRole: params.userRole } }
    );

    return rows.length > 0;
}

/**
 * 어드민용 사용자 삭제를 수행합니다.
 *
 * 정책:
 * - 게시글이 있는 사용자는 삭제하지 않습니다(`has_posts`).
 *
 * @param userId 대상 사용자 ID
 */
export async function deleteUserForAdmin(userId: number): Promise<DeleteUserForAdminResult> {
    const deletedRows = await sequelize.query<{ user_id: number }>(
        `
        DELETE FROM users
        WHERE user_id = :userId
          AND NOT EXISTS (
            SELECT 1
            FROM posts
            WHERE user_id = :userId
          )
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT, replacements: { userId } }
    );

    if (deletedRows.length > 0) {
        return "deleted";
    }

    const existingRows = await sequelize.query<{ user_id: number }>(
        `
        SELECT user_id
        FROM users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { userId } }
    );

    if (existingRows.length === 0) {
        return "not_found";
    }

    return "has_posts";
}
