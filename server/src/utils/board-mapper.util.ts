import type { BoardMeta } from "../types/board.types.js";
import type { BoardMetaRow } from "../types/board-data.types.js";

/**
 * DB 조회 결과(BoardMetaRow)를 애플리케이션 타입(BoardMeta)으로 매핑합니다.
 */
export function mapBoardMeta(row: BoardMetaRow): BoardMeta {
    return {
        boardId: Number(row.board_id),
        slug: row.slug,
        name: row.name,
        description: row.description ?? null,
        readAccess: row.read_access as BoardMeta["readAccess"],
        createAccess: row.create_access as BoardMeta["createAccess"],
    };
}
