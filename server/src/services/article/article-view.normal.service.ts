import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { ArticleForShow, NeighborPost } from "../../types/article.types.js";
import type { ArticleShowRow, NeighborPostRow } from "../../types/article-data.types.js";
import { mapArticleForShow, mapNeighborArticle } from "../../utils/article-mapper.util.js";

/**
 * 게시글 상세/이웃 조회 정상 모드 서비스입니다.
 *
 * 정책:
 * - SQLi lab 비활성화 상태에서 사용하는 구현입니다.
 * - 모든 DB 접근은 안전한 바인딩 쿼리를 사용합니다.
 */

export async function findArticleForShowBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<ArticleForShow | null> {
    const { slug, displayId } = params;

    const rows = await sequelize.query<ArticleShowRow>(
        `
        SELECT
            b.board_id,
            b.name AS board_name,
            b.slug AS board_slug,
            p.display_id,
            p.user_id,
            p.title,
            u.username,
            p.content,
            p.image_url,
            p.file_url,
            p.created_at,
            p.updated_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE b.slug = :slug
          AND p.display_id = :displayId
          AND p.use_yn = true
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { slug, displayId } }
    );

    const row = rows[0];
    return row ? mapArticleForShow(row) : null;
}

export async function findNeighborArticles(params: {
    boardId: number;
    displayId: number;
    viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
    const predicate = typeof params.viewerUserId === "number" ? " AND user_id = :viewerUserId" : "";
    const replacements =
        typeof params.viewerUserId === "number"
            ? { boardId: params.boardId, displayId: params.displayId, viewerUserId: params.viewerUserId }
            : { boardId: params.boardId, displayId: params.displayId };

    const [prevRows, nextRows] = await Promise.all([
        sequelize.query<NeighborPostRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = :boardId
              AND use_yn = true
              AND display_id < :displayId
              ${predicate}
            ORDER BY display_id DESC
            LIMIT 1
            `,
            { type: QueryTypes.SELECT, replacements }
        ),
        sequelize.query<NeighborPostRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = :boardId
              AND use_yn = true
              AND display_id > :displayId
              ${predicate}
            ORDER BY display_id ASC
            LIMIT 1
            `,
            { type: QueryTypes.SELECT, replacements }
        ),
    ]);

    const prevPost: NeighborPost = mapNeighborArticle(prevRows[0]);
    const nextPost: NeighborPost = mapNeighborArticle(nextRows[0]);

    return { prevPost, nextPost };
}
