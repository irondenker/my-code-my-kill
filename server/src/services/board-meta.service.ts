import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";
import { getLabOptions } from "../config/lab-options.js";
import type { BoardCreateAccess, BoardMeta, BoardReadAccess } from "../types/board.types.js";
import { runWithSqlInjectionOption } from "../utils/sql-injection.util.js";

/**
 * 보드 메타(boards 테이블) 관련 DB 쿼리를 제공하는 서비스입니다.
 *
 * 책임:
 * - 보드 목록/단건 조회 및 생성/수정
 * - SQLi 실습 옵션에 따른 취약/안전 쿼리 분기
 */

const sqlInjectionOptions = getLabOptions().sqlInjection;

/**
 * board-meta에서 사용하는 SQLi 분기 헬퍼입니다.
 * 공통 유틸의 `runWithSqlInjectionOption`에 전역 옵션을 함께 전달합니다.
 */
async function runWithBoardMetaSqlInjectionOption<T>(params: {
    targetEnabled: boolean;
    insecure: () => Promise<T>;
    safe: () => Promise<T>;
}): Promise<T> {
    return runWithSqlInjectionOption<T>({
        sqlInjectionOptions,
        targetEnabled: params.targetEnabled,
        insecure: params.insecure,
        safe: params.safe,
    });
}

/**
 * 보드 목록을 반환합니다.
 */
export async function listBoards(): Promise<BoardMeta[]> {
    const rows = await sequelize.query<{
        board_id: number;
        slug: string;
        name: string;
        description: string | null;
        read_access: string;
        create_access: string;
    }>(
        `
        SELECT board_id, slug, name, description, read_access, create_access
        FROM boards
        ORDER BY name ASC
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.map((row) => ({
        boardId: Number(row.board_id),
        slug: row.slug,
        name: row.name,
        description: row.description ?? null,
        readAccess: row.read_access as BoardReadAccess,
        createAccess: row.create_access as BoardCreateAccess,
    }));
}

/**
 * slug로 보드 메타를 조회합니다.
 * SQLi 실습 옵션에 따라 취약 쿼리로 동작할 수 있습니다.
 */
export async function findBoardBySlug(slug: string): Promise<BoardMeta | null> {
    return runWithBoardMetaSqlInjectionOption<BoardMeta | null>({
        targetEnabled: sqlInjectionOptions.targets.boardLookupBySlug,
        insecure: async () => {
            const rows = await sequelize.query<{
                board_id: number;
                slug: string;
                name: string;
                description: string | null;
                read_access: string;
                create_access: string;
            }>(
                `
                SELECT board_id, slug, name, description, read_access, create_access
                FROM boards
                WHERE slug = '${slug}'
                LIMIT 1
                `,
                { type: QueryTypes.SELECT }
            );

            const row = rows[0];
            if (!row) {
                return null;
            }

            return {
                boardId: Number(row.board_id),
                slug: row.slug,
                name: row.name,
                description: row.description ?? null,
                readAccess: row.read_access as BoardReadAccess,
                createAccess: row.create_access as BoardCreateAccess,
            };
        },
        safe: async () => {
            const rows = await sequelize.query<{
                board_id: number;
                slug: string;
                name: string;
                description: string | null;
                read_access: string;
                create_access: string;
            }>(
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
            if (!row) {
                return null;
            }

            return {
                boardId: Number(row.board_id),
                slug: row.slug,
                name: row.name,
                description: row.description ?? null,
                readAccess: row.read_access as BoardReadAccess,
                createAccess: row.create_access as BoardCreateAccess,
            };
        },
    });
}

/**
 * boardId로 보드 메타를 조회합니다.
 */
export async function findBoardById(boardId: number): Promise<BoardMeta | null> {
    const rows = await sequelize.query<{
        board_id: number;
        slug: string;
        name: string;
        description: string | null;
        read_access: string;
        create_access: string;
    }>(
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
    if (!row) {
        return null;
    }

    return {
        boardId: Number(row.board_id),
        slug: row.slug,
        name: row.name,
        description: row.description ?? null,
        readAccess: row.read_access as BoardReadAccess,
        createAccess: row.create_access as BoardCreateAccess,
    };
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
    return runWithBoardMetaSqlInjectionOption<BoardMeta>({
        targetEnabled: sqlInjectionOptions.targets.boardCreate,
        insecure: async () => {
            const slug = params.slug;
            const name = params.name;
            const description = params.description ?? null;
            const readAccess = params.readAccess ?? "public";
            const createAccess = params.createAccess ?? "auth";

            const rows = await sequelize.query<{
                board_id: number;
                slug: string;
                name: string;
                description: string | null;
                read_access: string;
                create_access: string;
            }>(
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

            return {
                boardId: Number(row.board_id),
                slug: row.slug,
                name: row.name,
                description: row.description ?? null,
                readAccess: row.read_access as BoardReadAccess,
                createAccess: row.create_access as BoardCreateAccess,
            };
        },
        safe: async () => {
            const rows = await sequelize.query<{
                board_id: number;
                slug: string;
                name: string;
                description: string | null;
                read_access: string;
                create_access: string;
            }>(
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

            return {
                boardId: Number(row.board_id),
                slug: row.slug,
                name: row.name,
                description: row.description ?? null,
                readAccess: row.read_access as BoardReadAccess,
                createAccess: row.create_access as BoardCreateAccess,
            };
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
    return runWithBoardMetaSqlInjectionOption<boolean>({
        targetEnabled: sqlInjectionOptions.targets.boardUpdate,
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
