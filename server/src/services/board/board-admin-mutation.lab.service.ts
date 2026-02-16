import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { BoardCreateAccess, BoardMeta, BoardReadAccess } from "../../types/board.types.js";
import type { BoardMetaRow } from "../../types/board-data.types.js";
import { mapBoardMeta } from "../../utils/board-mapper.util.js";

/**
 * 보드 생성/수정 lab 모드 서비스입니다.
 *
 * 책임:
 * - facade가 lab 경로로 라우팅한 기능을 취약 쿼리로 실행합니다.
 * - 타깃 활성 여부 판정은 facade(`board-admin-mutation.service.ts`)에서 담당합니다.
 */

/**
 * 보드를 생성합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function createBoard(params: {
    slug: string;
    name: string;
    description?: string | null;
    readAccess?: BoardReadAccess;
    createAccess?: BoardCreateAccess;
}): Promise<BoardMeta> {
    const slug = params.slug;
    const name = params.name;
    const description = params.description ?? null;
    const readAccess = params.readAccess ?? "public";
    const createAccess = params.createAccess ?? "auth";

    const rows = await sequelize.query<BoardMetaRow>(
        `
        INSERT INTO boards (slug, name, description, read_access, create_access, created_at, updated_at)
        VALUES ('${slug}', '${name}', ${description === null ? "NULL" : `'${description}'`}, '${readAccess}', '${createAccess}', NOW(), NOW())
        RETURNING board_id, slug, name, description, read_access, create_access
        `,
        { type: QueryTypes.SELECT }
    );

    const row = rows[0];
    if (!row) {
        throw new Error("Failed to create board");
    }

    return mapBoardMeta(row);
}

/**
 * 보드를 업데이트합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function updateBoard(params: {
    boardId: number;
    slug: string;
    name: string;
    description?: string | null;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
}): Promise<boolean> {
    const description = params.description ?? null;
    const rows = await sequelize.query<{ board_id: number }>(
        `
        UPDATE boards
        SET slug = '${params.slug}',
            name = '${params.name}',
            description = ${description === null ? "NULL" : `'${description}'`},
            read_access = '${params.readAccess}',
            create_access = '${params.createAccess}',
            updated_at = NOW()
        WHERE board_id = ${params.boardId}
        RETURNING board_id
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.length > 0;
}
