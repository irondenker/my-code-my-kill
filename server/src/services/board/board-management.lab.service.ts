import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import { runWithSqlInjectionTarget } from "../lab/sql-injection-control.service.js";
import type { BoardCreateAccess, BoardMeta, BoardReadAccess } from "../../types/board.types.js";
import type { BoardMetaRow } from "../../types/board-data.types.js";
import { mapBoardMeta } from "../../utils/board-mapper.util.js";

/**
 * 보드 메타(boards) lab 모드 서비스입니다.
 *
 * 책임:
 * - SQLi 실습 타깃 기준으로 취약/안전 쿼리를 분기합니다.
 * - 타깃 비활성화 경로는 안전 쿼리(safe)로 동작합니다.
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
 * slug로 보드 메타를 조회합니다.
 * SQLi 실습 옵션에 따라 취약 쿼리로 동작할 수 있습니다.
 */
export async function findBoardBySlug(slug: string): Promise<BoardMeta | null> {
    return runWithSqlInjectionTarget<BoardMeta | null>({
        target: "boardLookupBySlug",
        insecure: async () => {
            const rows = await sequelize.query<BoardMetaRow>(
                `
                SELECT board_id, slug, name, description, read_access, create_access
                FROM boards
                WHERE slug = '${slug}'
                LIMIT 1
                `,
                { type: QueryTypes.SELECT }
            );

            const row = rows[0];
            return row ? mapBoardMeta(row) : null;
        },
        safe: async () => {
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
        },
    });
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

/**
 * 보드를 생성합니다.
 * SQLi 실습 옵션에 따라 취약 쿼리로 동작할 수 있습니다.
 */
export async function createBoard(params: {
    slug: string;
    name: string;
    description?: string | null;
    readAccess?: BoardReadAccess;
    createAccess?: BoardCreateAccess;
}): Promise<BoardMeta> {
    return runWithSqlInjectionTarget<BoardMeta>({
        target: "boardCreate",
        insecure: async () => {
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
        },
        safe: async () => {
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
        },
    });
}

/**
 * 보드를 업데이트합니다.
 * SQLi 실습 옵션에 따라 취약 쿼리로 동작할 수 있습니다.
 */
export async function updateBoard(params: {
    boardId: number;
    slug: string;
    name: string;
    description?: string | null;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
}): Promise<boolean> {
    return runWithSqlInjectionTarget<boolean>({
        target: "boardUpdate",
        insecure: async () => {
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
        },
        safe: async () => {
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
        },
    });
}
