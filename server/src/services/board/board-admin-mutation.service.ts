import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./board-admin-mutation.lab.service.js";
import * as normalImplementation from "./board-admin-mutation.normal.service.js";
import type { BoardCreateAccess, BoardMeta, BoardReadAccess } from "../../types/board/board.types.js";

/**
 * 보드 생성/수정(어드민 mutation) 전용 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `board-admin-mutation.lab.service`를 사용합니다.
 * - 그 외 기능은 `board-admin-mutation.normal.service`를 사용합니다.
 */

export async function createBoard(params: {
    slug: string;
    name: string;
    description?: string | null;
    readAccess?: BoardReadAccess;
    createAccess?: BoardCreateAccess;
}): Promise<BoardMeta> {
    if (isSqlInjectionTargetEnabled("boardCreate")) {
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
    if (isSqlInjectionTargetEnabled("boardUpdate")) {
        return labImplementation.updateBoard(params);
    }
    return normalImplementation.updateBoard(params);
}
