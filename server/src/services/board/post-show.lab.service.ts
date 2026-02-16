import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import type { BoardPostForShow, NeighborPost } from "../../types/board.types.js";
import type { BoardPostShowRow, NeighborPostRow } from "../../types/board-data.types.js";
import { mapBoardPostForShow, mapNeighborPost } from "../../utils/board-mapper.util.js";

/**
 * 게시글 상세/이웃 조회 lab 모드 서비스입니다.
 *
 * 목적:
 * - 컨트롤러에서 raw SQL/Sequelize 의존을 제거하고, HTTP 흐름만 남깁니다.
 * - 게시글 상세 페이지에서 필요한 join/neighbor 조회를 캡슐화합니다.
 *
 * 주의:
 * - SQLi 실습 타깃(`postLookup`)이 켜진 경우 상세 조회는 취약 쿼리로 동작할 수 있습니다.
 */

/**
 * 게시글 상세 화면에서 필요한 데이터를 조회합니다.
 */
export async function findBoardPostForShowBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<BoardPostForShow | null> {
    const { slug, displayId } = params;

    if (isSqlInjectionTargetEnabled("postLookup")) {
        const rows = await sequelize.query<BoardPostShowRow>(
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
            WHERE b.slug = '${slug}'
              AND p.display_id = ${displayId}
              AND p.use_yn = true
            LIMIT 1
            `,
            { type: QueryTypes.SELECT }
        );

        const row = rows[0];
        return row ? mapBoardPostForShow(row) : null;
    }

    const rows = await sequelize.query<BoardPostShowRow>(
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
    return row ? mapBoardPostForShow(row) : null;
}

/**
 * 게시글 상세 화면에서 이전/다음 게시글 링크를 조회합니다.
 */
export async function findNeighborPosts(params: {
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

    const prevPost: NeighborPost = mapNeighborPost(prevRows[0]);
    const nextPost: NeighborPost = mapNeighborPost(nextRows[0]);

    return { prevPost, nextPost };
}
