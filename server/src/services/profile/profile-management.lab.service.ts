import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import { runWithSqlInjectionTarget } from "../lab/sql-injection-control.service.js";
import type { UserProfile } from "../../types/auth.types.js";
import type { UserProfileRow } from "../../types/profile-data.types.js";
import { mapUserProfile } from "../../utils/profile-mapper.util.js";
import {
    findPublicProfileByUsername,
    findUserProfileById,
    findUserProfileByUsernameSafe,
    updateUserProfileImage,
    updateUserProfileSafe,
} from "./profile-management.normal.service.js";

/**
 * 프로필 관리 lab 모드 서비스입니다.
 *
 * 책임:
 * - SQLi 실습 타깃(`profileLookupByUsername`, `profileUpdate`) 기준으로
 *   취약/안전 경로를 선택합니다.
 * - 타깃 비활성화 기능은 정상(safe) 구현을 재사용합니다.
 */

async function findUserProfileByUsernameInsecureForLab(username: string): Promise<UserProfile | null> {
    const rows = await sequelize.query<UserProfileRow>(
        `
        SELECT
            user_id,
            username,
            email,
            phone_number,
            display_name,
            profile_image_url,
            bio,
            created_at
        FROM users
        WHERE username = '${username}'
        LIMIT 1
        `,
        { type: QueryTypes.SELECT }
    );

    const row = rows[0];
    return row ? mapUserProfile(row) : null;
}

async function updateUserProfileInsecureForLab(params: {
    userId: number;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    bio: string | null;
}): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET display_name = '${params.displayName ?? ""}',
            email = '${params.email ?? ""}',
            phone_number = '${params.phoneNumber ?? ""}',
            bio = '${params.bio ?? ""}',
            updated_at = NOW()
        WHERE user_id = ${params.userId}
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.length > 0;
}

export { findPublicProfileByUsername, findUserProfileById, updateUserProfileImage };

export async function findUserProfileByUsername(username: string): Promise<UserProfile | null> {
    return runWithSqlInjectionTarget<UserProfile | null>({
        target: "profileLookupByUsername",
        insecure: () => findUserProfileByUsernameInsecureForLab(username),
        safe: () => findUserProfileByUsernameSafe(username),
    });
}

export async function updateUserProfile(params: {
    userId: number;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    bio: string | null;
}): Promise<boolean> {
    return runWithSqlInjectionTarget<boolean>({
        target: "profileUpdate",
        insecure: () => updateUserProfileInsecureForLab(params),
        safe: () => updateUserProfileSafe(params),
    });
}
