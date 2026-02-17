import { QueryTypes, type Transaction } from "sequelize";
import { sequelize } from "../../db/index.js";

/**
 * 게시글 쓰기/수정/삭제 정상 모드 서비스입니다.
 *
 * 정책:
 * - SQLi lab 비활성화 상태에서 사용하는 구현입니다.
 * - create/update는 안전한 바인딩 쿼리만 사용합니다.
 */

export async function createArticle(params: {
    boardId: number;
    userId: number;
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
}): Promise<{ displayId: number }> {
    const { boardId, userId, title, content, imageUrl, fileUrl } = params;

    return sequelize.transaction(async (transaction: Transaction) => {
        const displayRows = await sequelize.query<{ display_id: number }>(
            `
            WITH max_display AS (
                SELECT COALESCE(MAX(display_id), 0) AS max_display_id
                FROM posts
                WHERE board_id = :boardId
            ),
            upsert AS (
                INSERT INTO board_post_counters (board_id, next_display_id)
                SELECT :boardId, max_display_id + 2 FROM max_display
                ON CONFLICT (board_id) DO UPDATE
                SET next_display_id = GREATEST(
                    board_post_counters.next_display_id,
                    (SELECT max_display_id + 1 FROM max_display)
                ) + 1
                RETURNING next_display_id
            )
            SELECT next_display_id - 1 AS display_id FROM upsert
            `,
            { type: QueryTypes.SELECT, replacements: { boardId }, transaction }
        );

        const displayId = Number(displayRows[0]?.display_id);
        if (!Number.isFinite(displayId) || displayId <= 0) {
            throw new Error("Failed to allocate display id");
        }

        await sequelize.query(
            `
            INSERT INTO posts (
                board_id,
                display_id,
                user_id,
                title,
                content,
                image_url,
                file_url,
                created_at,
                updated_at,
                use_yn
            )
            VALUES (
                :boardId,
                :displayId,
                :userId,
                :title,
                :content,
                :imageUrl,
                :fileUrl,
                NOW(),
                NOW(),
                true
            )
            `,
            {
                replacements: {
                    boardId,
                    displayId,
                    userId,
                    title,
                    content,
                    imageUrl: imageUrl ?? null,
                    fileUrl: fileUrl ?? null,
                },
                transaction,
            }
        );

        return { displayId };
    });
}

export async function updateArticle(params: {
    postId: number;
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
}): Promise<boolean> {
    const { postId, title, content, imageUrl, fileUrl } = params;

    const rows = await sequelize.query<{ post_id: number }>(
        `
        UPDATE posts
        SET title = :title,
            content = :content,
            image_url = :imageUrl,
            file_url = :fileUrl,
            updated_at = NOW()
        WHERE post_id = :postId
          AND use_yn = true
        RETURNING post_id
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                postId,
                title,
                content,
                imageUrl: imageUrl ?? null,
                fileUrl: fileUrl ?? null,
            },
        }
    );
    return rows.length > 0;
}

export async function softDeleteArticleBySlugDisplayIdAsAdmin(params: { slug: string; displayId: number }): Promise<boolean> {
    const { slug, displayId } = params;
    const rows = await sequelize.query<{ post_id: number }>(
        `
        WITH updated AS (
            UPDATE posts p
            SET use_yn = false,
                updated_at = NOW()
            FROM boards b
            WHERE p.board_id = b.board_id
              AND b.slug = :slug
              AND p.display_id = :displayId
              AND p.use_yn = true
            RETURNING p.post_id
        )
        SELECT post_id FROM updated
        `,
        { type: QueryTypes.SELECT, replacements: { slug, displayId } }
    );

    return rows.length > 0;
}

export async function softDeleteArticleBySlugDisplayId(params: {
    slug: string;
    displayId: number;
    requestUserId: number;
}): Promise<boolean> {
    const { slug, displayId, requestUserId } = params;
    const rows = await sequelize.query<{ post_id: number }>(
        `
        WITH updated AS (
            UPDATE posts p
            SET use_yn = false,
                updated_at = NOW()
            FROM boards b, users u
            WHERE p.board_id = b.board_id
              AND b.slug = :slug
              AND p.display_id = :displayId
              AND p.use_yn = true
              AND u.user_id = :requestUserId
              AND (u.user_role = 'admin' OR p.user_id = u.user_id)
            RETURNING p.post_id
        )
        SELECT post_id FROM updated
        `,
        { type: QueryTypes.SELECT, replacements: { slug, displayId, requestUserId } }
    );

    return rows.length > 0;
}
