import { isSqlInjectionLabEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./board-management.lab.service.js";
import * as normalImplementation from "./board-management.normal.service.js";
import type { BoardCreateAccess, BoardMeta, BoardReadAccess } from "../../types/board.types.js";

/**
 * 보드 메타 서비스 facade입니다.
 *
 * 모드:
 * - SQLi lab 활성화: `board-management.lab.service`
 * - SQLi lab 비활성화: `board-management.normal.service`
 */

const useLabImplementation = isSqlInjectionLabEnabled();

export async function listBoards(): Promise<BoardMeta[]> {
    if (useLabImplementation) {
        return labImplementation.listBoards();
    }
    return normalImplementation.listBoards();
}

export async function findBoardBySlug(slug: string): Promise<BoardMeta | null> {
    if (useLabImplementation) {
        return labImplementation.findBoardBySlug(slug);
    }
    return normalImplementation.findBoardBySlug(slug);
}

export async function findBoardById(boardId: number): Promise<BoardMeta | null> {
    if (useLabImplementation) {
        return labImplementation.findBoardById(boardId);
    }
    return normalImplementation.findBoardById(boardId);
}

export async function createBoard(params: {
    slug: string;
    name: string;
    description?: string | null;
    readAccess?: BoardReadAccess;
    createAccess?: BoardCreateAccess;
}): Promise<BoardMeta> {
    if (useLabImplementation) {
        return labImplementation.createBoard(params);
    }
    return normalImplementation.createBoard(params);
}

export async function updateBoard(params: {
    boardId: number;
    slug: string;
    name: string;
    description?: string | null;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
}): Promise<boolean> {
    if (useLabImplementation) {
        return labImplementation.updateBoard(params);
    }
    return normalImplementation.updateBoard(params);
}
