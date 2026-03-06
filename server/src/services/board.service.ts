/**
 * 보드(게시판) 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 기존 import 경로(`../services/board.service.js`)를 유지하면서,
 *   보드 도메인(메타/관리) 기능만 노출합니다.
 */

// Types
export type { BoardReadAccess, BoardCreateAccess, BoardMeta } from '../types/board/board.types.js';

// Board queries (boards)
export { listBoards, findBoardBySlug, findBoardById } from './board/board-query.service.js';

// Board mutations (admin)
export { createBoard, updateBoard } from './board/board-admin-mutation.service.js';
