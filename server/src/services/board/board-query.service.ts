import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./board-query.lab.service.js";
import * as normalImplementation from "./board-query.normal.service.js";
import type { BoardMeta } from "../../types/board/board.types.js";

/**
 * 보드 메타 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `board-query.lab.service`를 사용합니다.
 * - 그 외 기능은 `board-query.normal.service`를 사용합니다.
 */

export async function listBoards(): Promise<BoardMeta[]> {
    return normalImplementation.listBoards();
}

export async function findBoardBySlug(slug: string): Promise<BoardMeta | null> {
    if (isSqlInjectionTargetEnabled("boardLookup")) {
        return labImplementation.findBoardBySlug(slug);
    }
    return normalImplementation.findBoardBySlug(slug);
}

export async function findBoardById(boardId: number): Promise<BoardMeta | null> {
    if (isSqlInjectionTargetEnabled("boardLookup")) {
        return labImplementation.findBoardById(boardId);
    }
    return normalImplementation.findBoardById(boardId);
}
