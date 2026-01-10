import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.ts";

export type BoardMeta = {
    boardId: number;
    slug: string;
    name: string;
};

export type BoardPostRecord = {
    postId: number;
    boardId: number;
    boardSlug: string;
    boardName: string;
    displayId: number;
    userId: number;
    title: string;
    content: string;
};

export async function countBoardPosts(): Promise<number> {
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM posts
        WHERE use_yn = true
        `,
        { type: QueryTypes.SELECT }
    );

    return Number(rows[0]?.total_count ?? 0);
}

export async function countBoardPostsBySlug(slug: string): Promise<number> {
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        WHERE p.use_yn = true
          AND b.slug = :slug
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug },
        }
    );

    return Number(rows[0]?.total_count ?? 0);
}

export async function listBoardPostOutlines(params: {
    offset: number,
    limit: number
}) {
    const { offset, limit } = params;

    const rows = await sequelize.query<{
        board_slug: string;
        display_id: number;
        title: string;
        author: string;
        created_at: Date;
    }>(
        `
        SELECT
            b.slug AS board_slug,
            p.display_id,
            p.title,
            u.username AS author,
            p.created_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE p.use_yn = true
        ORDER BY p.display_id DESC
        LIMIT :limit
        OFFSET :offset
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { limit, offset },
        }
    );

    return rows.map((row) => ({
        boardSlug: row.board_slug,
        displayId: Number(row.display_id),
        title: row.title,
        author: row.author,
        createdAt: new Date(row.created_at),
    }));
}

export async function listBoardPostOutlinesBySlug(params: {
    slug: string,
    offset: number,
    limit: number
}) {
    const { slug, offset, limit } = params;

    const rows = await sequelize.query<{
        board_slug: string;
        display_id: number;
        title: string;
        author: string;
        created_at: Date;
    }>(
        `
        SELECT
            b.slug AS board_slug,
            p.display_id,
            p.title,
            u.username AS author,
            p.created_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE p.use_yn = true
          AND b.slug = :slug
        ORDER BY p.created_at DESC
        LIMIT :limit
        OFFSET :offset
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug, limit, offset },
        }
    );

    return rows.map((row) => ({
        boardSlug: row.board_slug,
        displayId: Number(row.display_id),
        title: row.title,
        author: row.author,
        createdAt: new Date(row.created_at),
    }));
}

export async function findBoardBySlug(slug: string): Promise<BoardMeta | null> {
    const rows = await sequelize.query<{ board_id: number; slug: string; name: string }>(
        `
        SELECT board_id, slug, name
        FROM boards
        WHERE slug = :slug
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug },
        }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return {
        boardId: Number(row.board_id),
        slug: row.slug,
        name: row.name,
    };
}

export async function findPostBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<BoardPostRecord | null> {
    const { slug, displayId } = params;
    const rows = await sequelize.query<{
        post_id: number;
        board_id: number;
        board_slug: string;
        board_name: string;
        display_id: number;
        user_id: number;
        title: string;
        content: string;
    }>(
        `
        SELECT
            p.post_id,
            b.board_id,
            b.slug AS board_slug,
            b.name AS board_name,
            p.display_id,
            p.user_id,
            p.title,
            p.content
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        WHERE b.slug = :slug
          AND p.display_id = :displayId
          AND p.use_yn = true
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug, displayId },
        }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return {
        postId: Number(row.post_id),
        boardId: Number(row.board_id),
        boardSlug: row.board_slug,
        boardName: row.board_name,
        displayId: Number(row.display_id),
        userId: Number(row.user_id),
        title: row.title,
        content: row.content,
    };
}

export async function findBoardDisplayNameBySlug(slug: string): Promise<string | null> {
    const rows = await sequelize.query<{ name: string }>(
        `
        SELECT name
        FROM boards
        WHERE slug = :slug
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug },
        }
    );

    return rows[0]?.name ?? null;
}

export async function createBoardPost(params: {
    boardId: number;
    userId: number;
    title: string;
    content: string;
}): Promise<{ displayId: number }> {
    const { boardId, userId, title, content } = params;

    return sequelize.transaction(async (transaction) => {
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
            {
                type: QueryTypes.SELECT,
                replacements: { boardId },
                transaction,
            }
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
                NOW(),
                NOW(),
                true
            )
            `,
            {
                replacements: { boardId, displayId, userId, title, content },
                transaction,
            }
        );

        return { displayId };
    });
}

export async function updateBoardPost(params: {
    postId: number;
    title: string;
    content: string;
}): Promise<boolean> {
    const { postId, title, content } = params;
    const rows = await sequelize.query<{ post_id: number }>(
        `
        UPDATE posts
        SET title = :title,
            content = :content,
            updated_at = NOW()
        WHERE post_id = :postId
          AND use_yn = true
        RETURNING post_id
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { postId, title, content },
        }
    );

    return rows.length > 0;
}

export async function doesPostExistBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<boolean> {
    const { slug, displayId } = params;
    const rows = await sequelize.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM posts p
            JOIN boards b ON p.board_id = b.board_id
            WHERE b.slug = :slug
              AND p.display_id = :displayId
              AND p.use_yn = true
        ) AS exists
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug, displayId },
        }
    );

    return Boolean(rows[0]?.exists);
}

export async function softDeletePostBySlugDisplayIdAsAdmin(params: {
    slug: string;
    displayId: number;
}): Promise<boolean> {
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
        {
            type: QueryTypes.SELECT,
            replacements: { slug, displayId },
        }
    );

    return rows.length > 0;
}

export async function softDeletePostBySlugDisplayId(params: {
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
        {
            type: QueryTypes.SELECT,
            replacements: { slug, displayId, requestUserId },
        }
    );

    return rows.length > 0;
}
