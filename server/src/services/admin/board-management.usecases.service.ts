import { createBoard, updateBoard } from "../board/board-admin-mutation.service.js";
import type { BoardCreateAccess, BoardMeta, BoardReadAccess } from "../../types/board.types.js";

/**
 * 어드민 보드 생성 유즈케이스입니다.
 */
export async function adminCreateBoard(params: {
    slug: string;
    name: string;
    description?: string | null;
    readAccess?: BoardReadAccess;
    createAccess?: BoardCreateAccess;
}): Promise<BoardMeta> {
    return createBoard(params);
}

/**
 * 어드민 보드 수정 유즈케이스입니다.
 */
export async function adminUpdateBoard(params: {
    boardId: number;
    slug: string;
    name: string;
    description?: string | null;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
}): Promise<boolean> {
    return updateBoard(params);
}
