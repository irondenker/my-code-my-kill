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
    // 어드민 화면에서 필요한 필드만 users 테이블에서 조회합니다.
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

    // DB 스네이크 케이스를 애플리케이션 카멜 케이스로 매핑합니다.
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
    // 대상 유저의 is_active 값을 갱신하고, 갱신 여부를 RETURNING으로 확인합니다.
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

    // 갱신된 행이 1개 이상이면 성공으로 봅니다.
    return rows.length > 0;
}

/**
 * 어드민 정책/화면용 사용자 최소 메타 정보를 조회합니다.
 *
 * @param userId 대상 사용자 ID
 */
export async function findUserMetaForAdminById(userId: number): Promise<AdminUserMeta | null> {
    // 정책 판정에 필요한 최소 필드만 조회합니다.
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

    // 결과가 없으면 대상 사용자가 존재하지 않습니다.
    const row = rows[0];
    if (!row) {
        return null;
    }

    // 반환 타입(AdminUserMeta)에 맞춰 정규화합니다.
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
    // admin 역할 사용자 수를 COUNT(*)로 조회합니다.
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM users
        WHERE user_role = 'admin'
        `,
        { type: QueryTypes.SELECT }
    );

    // COUNT 결과는 드라이버에 따라 문자열로 올 수 있어 Number로 변환합니다.
    return Number(rows[0]?.total_count ?? 0);
}

/**
 * 사용자 역할(user/admin)을 변경합니다.
 *
 * @param params 변경 파라미터
 */
export async function updateUserRole(params: { userId: number; userRole: "admin" | "user" }): Promise<boolean> {
    // 대상 유저의 role을 갱신하고, 갱신 여부를 RETURNING으로 확인합니다.
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

    // 갱신된 행이 1개 이상이면 성공으로 봅니다.
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
    // 게시글이 없는 사용자만 삭제되도록 조건부 DELETE를 시도합니다.
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

    // DELETE가 성공하면 RETURNING 결과가 존재합니다.
    if (deletedRows.length > 0) {
        return "deleted";
    }

    // 삭제가 실패한 경우: (1) 사용자가 없거나 (2) 게시글이 있어 삭제가 막혔을 수 있습니다.
    const existingRows = await sequelize.query<{ user_id: number }>(
        `
        SELECT user_id
        FROM users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { userId } }
    );

    // 사용자 자체가 없다면 not_found입니다.
    if (existingRows.length === 0) {
        return "not_found";
    }

    // 사용자는 존재하지만 삭제가 되지 않았다면 게시글이 존재하는 케이스로 봅니다.
    return "has_posts";
}
