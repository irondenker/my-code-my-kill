import type { BoardCreateAccess, BoardReadAccess } from "../types/board.types.js";

/**
 * 보드(메타) 입력 검증 유틸입니다.
 *
 * 원칙:
 * - I/O(req/res/session) 없이 동작하는 순수 함수만 둡니다.
 * - 권한 판정(policy)과 분리해 "보드 입력값 형태 검증"만 담당합니다.
 * - 게시글(Article) 입력 검증은 `article-validation.util.ts`에서 담당합니다.
 */

const BOARD_READ_ACCESS_VALUES: readonly BoardReadAccess[] = ["public", "auth", "admin", "owner_or_admin"];
const BOARD_CREATE_ACCESS_VALUES: readonly BoardCreateAccess[] = ["auth", "admin"];

/**
 * 문자열이 `BoardReadAccess` 허용값인지 판정하는 type guard입니다.
 *
 * @param value 후보 문자열
 */
export function isBoardReadAccess(value: string): value is BoardReadAccess {
    return BOARD_READ_ACCESS_VALUES.includes(value as BoardReadAccess);
}

/**
 * 문자열이 `BoardCreateAccess` 허용값인지 판정하는 type guard입니다.
 *
 * @param value 후보 문자열
 */
export function isBoardCreateAccess(value: string): value is BoardCreateAccess {
    return BOARD_CREATE_ACCESS_VALUES.includes(value as BoardCreateAccess);
}

/**
 * 보드 slug 규칙을 검증합니다.
 *
 * 규칙:
 * - 2~50자
 * - 소문자/숫자/하이픈만 허용(연속 하이픈은 허용, 시작/끝 하이픈은 불가)
 *
 * @param value 보드 slug 후보 값
 */
export function isValidBoardSlug(value: string): boolean {
    if (value.length < 2 || value.length > 50) {
        return false;
    }
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
