import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { BoardMeta } from "../../types/board/board.types.js";
import type { BoardMetaRow } from "../../types/board/board-data.types.js";
import { mapBoardMeta } from "../../utils/board/board-mapper.util.js";

/**
 * 보드 메타(boards) 정상 모드 서비스입니다.
 *
 * 정책:
 * - SQLi lab 비활성화 상태에서 사용하는 구현입니다.
 * - 모든 DB 접근은 안전한 바인딩 쿼리를 사용합니다.
 */

/**
 * 보드 목록을 반환합니다.
 */
export async function listBoards(): Promise<BoardMeta[]> {
    const rows = await sequelize.query<BoardMetaRow>(
        `
        SELECT board_id, slug, name, description, read_access, create_access
        FROM boards
        ORDER BY name ASC
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.map(mapBoardMeta);
}

/**
 * slug로 보드 메타를 안전하게 조회합니다.
 */
export async function findBoardBySlug(slug: string): Promise<BoardMeta | null> {
    const rows = await sequelize.query<BoardMetaRow>(
        `
        SELECT board_id, slug, name, description, read_access, create_access
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
    return row ? mapBoardMeta(row) : null;
}

/**
 * boardId로 보드 메타를 조회합니다.
 */
export async function findBoardById(boardId: number): Promise<BoardMeta | null> {
    const rows = await sequelize.query<BoardMetaRow>(
        `
        SELECT board_id, slug, name, description, read_access, create_access
        FROM boards
        WHERE board_id = :boardId
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { boardId },
        }
    );

    const row = rows[0];
    return row ? mapBoardMeta(row) : null;
}
