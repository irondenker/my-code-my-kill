import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { BoardCreateAccess, BoardMeta, BoardReadAccess } from "../../types/board.types.js";
import type { BoardMetaRow } from "../../types/board-data.types.js";
import { mapBoardMeta } from "../../utils/board-mapper.util.js";

/**
 * 보드 생성/수정 정상 모드 서비스입니다.
 *
 * 정책:
 * - SQLi lab 비활성화 상태에서 사용하는 구현입니다.
 * - 모든 DB 접근은 안전한 바인딩 쿼리를 사용합니다.
 */

/**
 * 보드를 안전하게 생성합니다.
 */
export async function createBoard(params: {
    slug: string;
    name: string;
    description?: string | null;
    readAccess?: BoardReadAccess;
    createAccess?: BoardCreateAccess;
}): Promise<BoardMeta> {
    const rows = await sequelize.query<BoardMetaRow>(
        `
        INSERT INTO boards (slug, name, description, read_access, create_access, created_at, updated_at)
        VALUES (:slug, :name, :description, :readAccess, :createAccess, NOW(), NOW())
        RETURNING board_id, slug, name, description, read_access, create_access
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                slug: params.slug,
                name: params.name,
                description: params.description ?? null,
                readAccess: params.readAccess ?? "public",
                createAccess: params.createAccess ?? "auth",
            },
        }
    );

    const row = rows[0];
    if (!row) {
        throw new Error("Failed to create board");
    }

    return mapBoardMeta(row);
}

/**
 * 보드를 안전하게 업데이트합니다.
 */
export async function updateBoard(params: {
    boardId: number;
    slug: string;
    name: string;
    description?: string | null;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
}): Promise<boolean> {
    const rows = await sequelize.query<{ board_id: number }>(
        `
        UPDATE boards
        SET slug = :slug,
            name = :name,
            description = :description,
            read_access = :readAccess,
            create_access = :createAccess,
            updated_at = NOW()
        WHERE board_id = :boardId
        RETURNING board_id
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                boardId: params.boardId,
                slug: params.slug,
                name: params.name,
                description: params.description ?? null,
                readAccess: params.readAccess,
                createAccess: params.createAccess,
            },
        }
    );

    return rows.length > 0;
}
