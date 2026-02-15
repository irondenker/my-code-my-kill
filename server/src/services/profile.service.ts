import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";
import { getLabOptions } from "../config/lab-options.js";
import type { PublicUserProfile, UserProfile } from "../types/auth.types.js";
import { runWithSqlInjectionOption } from "../utils/sql-injection.util.js";

/**
 * 사용자 프로필 조회/수정에 필요한 DB 쿼리를 제공하는 서비스입니다.
 *
 * 주의:
 * - SQLi 실습 옵션이 켜진 경우 일부 쿼리는 의도적으로 취약한 형태로 동작합니다.
 * - 실제 운영 환경에서는 `sqlInjection.enabled`를 켜지 마세요.
 */
const sqlInjectionOptions = getLabOptions().sqlInjection;

type UserProfileRow = {
    user_id: number;
    username: string;
    email: string | null;
    phone_number: string | null;
    display_name: string | null;
    profile_image_url: string | null;
    bio: string | null;
    created_at: Date;
};

type PublicProfileRow = {
    username: string;
    email: string | null;
    phone_number: string | null;
    display_name: string | null;
    profile_image_url: string | null;
    bio: string | null;
    created_at: Date;
};

/**
 * profile 서비스에서 사용하는 SQLi 분기 헬퍼입니다.
 * 공통 유틸의 `runWithSqlInjectionOption`에 전역 옵션을 함께 전달합니다.
 */
async function runWithProfileSqlInjectionOption<T>(params: {
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
 * DB 조회 결과(UserProfileRow)를 애플리케이션 타입(UserProfile)으로 매핑합니다.
 */
function mapUserProfile(row: UserProfileRow): UserProfile {
    return {
        userId: Number(row.user_id),
        username: row.username,
        email: row.email ?? null,
        phoneNumber: row.phone_number ?? null,
        displayName: row.display_name ?? null,
        profileImageUrl: row.profile_image_url ?? null,
        bio: row.bio ?? null,
        createdAt: row.created_at,
    };
}

/**
 * DB 조회 결과(PublicProfileRow)를 애플리케이션 타입(PublicUserProfile)으로 매핑합니다.
 */
function mapPublicUserProfile(row: PublicProfileRow): PublicUserProfile {
    return {
        username: row.username,
        email: row.email ?? null,
        phoneNumber: row.phone_number ?? null,
        displayName: row.display_name ?? null,
        profileImageUrl: row.profile_image_url ?? null,
        bio: row.bio ?? null,
        createdAt: row.created_at,
    };
}

/**
 * userId로 사용자 프로필(사적 정보 포함)을 조회합니다.
 */
export async function findUserProfileById(userId: number): Promise<UserProfile | null> {
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
        WHERE user_id = :userId
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { userId } }
    );

    const row = rows[0];
    return row ? mapUserProfile(row) : null;
}

/**
 * username으로 사용자 프로필(사적 정보 포함)을 조회합니다.
 * SQLi 실습 옵션이 켜져 있으면 특정 타깃에서 취약 쿼리를 사용합니다.
 */
export async function findUserProfileByUsername(username: string): Promise<UserProfile | null> {
    return runWithProfileSqlInjectionOption<UserProfile | null>({
        targetEnabled: sqlInjectionOptions.targets.profileLookupByUsername,
        insecure: async () => {
            // 주의: SQLi 실습용으로 의도적으로 문자열 보간을 사용합니다.
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
            // 결과는 최대 1행이므로 첫 행만 사용합니다.
            const row = rows[0];
            return row ? mapUserProfile(row) : null;
        },
        safe: async () => {
            // 안전 쿼리: replacements 바인딩으로 username을 전달합니다.
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
                WHERE username = :username
                LIMIT 1
                `,
                { type: QueryTypes.SELECT, replacements: { username } }
            );

            // 결과는 최대 1행이므로 첫 행만 사용합니다.
            const row = rows[0];
            return row ? mapUserProfile(row) : null;
        },
    });
}

/**
 * username으로 공개 프로필을 조회합니다.
 * (실제 노출 여부는 컨트롤러에서 제한합니다.)
 */
export async function findPublicProfileByUsername(username: string): Promise<PublicUserProfile | null> {
    const rows = await sequelize.query<PublicProfileRow>(
        `
        SELECT
            username,
            email,
            phone_number,
            display_name,
            profile_image_url,
            bio,
            created_at
        FROM users
        WHERE username = :username
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { username } }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return mapPublicUserProfile(row);
}

/**
 * 사용자 프로필을 업데이트합니다.
 * SQLi 실습 옵션이 켜져 있으면 특정 타깃에서 취약 쿼리를 사용합니다.
 */
export async function updateUserProfile(params: {
    userId: number;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    bio: string | null;
}): Promise<boolean> {
    return runWithProfileSqlInjectionOption<boolean>({
        targetEnabled: sqlInjectionOptions.targets.profileUpdate,
        insecure: async () => {
            // 주의: SQLi 실습용으로 의도적으로 문자열 보간을 사용합니다.
            // null 입력은 빈 문자열로 저장하도록 처리합니다(기존 동작 유지 목적).
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
            // UPDATE ... RETURNING 결과가 1개 이상이면 갱신 성공으로 봅니다.
            return rows.length > 0;
        },
        safe: async () => {
            // 안전 쿼리: replacements 바인딩으로 값을 전달합니다(null은 null로 유지).
            const rows = await sequelize.query<{ user_id: number }>(
                `
                UPDATE users
                SET display_name = :displayName,
                    email = :email,
                    phone_number = :phoneNumber,
                    bio = :bio,
                    updated_at = NOW()
                WHERE user_id = :userId
                RETURNING user_id
                `,
                {
                    type: QueryTypes.SELECT,
                    replacements: {
                        userId: params.userId,
                        displayName: params.displayName,
                        email: params.email,
                        phoneNumber: params.phoneNumber,
                        bio: params.bio,
                    },
                }
            );

            // UPDATE ... RETURNING 결과가 1개 이상이면 갱신 성공으로 봅니다.
            return rows.length > 0;
        },
    });
}

/**
 * 사용자 프로필 이미지 경로(파일명)를 업데이트합니다.
 *
 * 주의:
 * - 여기서는 "파일명/경로 문자열"만 DB에 저장합니다.
 * - 실제 파일 저장/삭제는 컨트롤러에서 수행합니다.
 * - 성공 시 컨트롤러는 세션(`req.session.profileImageUrl`)도 함께 갱신해야 UI에 반영됩니다.
 */
export async function updateUserProfileImage(params: {
    userId: number;
    profileImageUrl: string | null;
}): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET profile_image_url = :profileImageUrl,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT, replacements: { userId: params.userId, profileImageUrl: params.profileImageUrl } }
    );

    return rows.length > 0;
}
