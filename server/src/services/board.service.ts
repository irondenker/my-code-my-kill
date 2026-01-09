import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.ts";

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
        ORDER BY p.created_at DESC
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
