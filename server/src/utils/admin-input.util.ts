import type { BoardCreateAccess, BoardReadAccess } from "../services/board.service.js";

/**
 * Admin 화면/컨트롤러에서 사용하는 입력값 정규화 및 검증 유틸 모음입니다.
 *
 * 원칙:
 * - I/O(req/res/session) 없이 동작하는 순수 함수만 둡니다.
 * - 컨트롤러에서는 이 모듈을 통해 입력값을 정규화/검증하고, 서비스 호출에 필요한 타입을 맞춥니다.
 */

/**
 * 보드 읽기 권한 허용값 목록입니다.
 * type guard(`isBoardReadAccess`)와 함께 사용합니다.
 */
export const BOARD_READ_ACCESS_VALUES: readonly BoardReadAccess[] = ["public", "auth", "admin", "owner_or_admin"];

/**
 * 보드 작성 권한 허용값 목록입니다.
 * type guard(`isBoardCreateAccess`)와 함께 사용합니다.
 */
export const BOARD_CREATE_ACCESS_VALUES: readonly BoardCreateAccess[] = ["auth", "admin"];

/**
 * 입력이 문자열이면 trim 처리하고, 그 외 타입이면 빈 문자열을 반환합니다.
 *
 * @param value 후보 입력값
 */
export function normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

/**
 * 입력이 문자열이면 trim 처리 후 빈 문자열이 아니면 반환하고, 아니면 null을 반환합니다.
 *
 * @param value 후보 입력값
 */
export function normalizeNullable(value: unknown): string | null {
    const trimmed = normalizeString(value);
    return trimmed ? trimmed : null;
}

/**
 * 보드 slug를 정규화합니다(소문자 강제).
 *
 * @param value 후보 slug
 */
export function normalizeBoardSlug(value: unknown): string {
    return normalizeString(value).toLowerCase();
}

/**
 * 보드 readAccess 값을 정규화합니다(소문자 강제).
 *
 * @param value 후보 readAccess
 */
export function normalizeBoardReadAccess(value: unknown): string {
    return normalizeString(value).toLowerCase();
}

/**
 * 보드 createAccess 값을 정규화합니다(소문자 강제).
 *
 * @param value 후보 createAccess
 */
export function normalizeBoardCreateAccess(value: unknown): string {
    return normalizeString(value).toLowerCase();
}

/**
 * 문자열이 `BoardReadAccess` 허용값인지 판정하는 type guard입니다.
 *
 * @param value 후보 값
 */
export function isBoardReadAccess(value: string): value is BoardReadAccess {
    return BOARD_READ_ACCESS_VALUES.includes(value as BoardReadAccess);
}

/**
 * 문자열이 `BoardCreateAccess` 허용값인지 판정하는 type guard입니다.
 *
 * @param value 후보 값
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
 * @param value slug
 */
export function isValidBoardSlug(value: string): boolean {
    if (value.length < 2 || value.length > 50) {
        return false;
    }
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * 어드민 보드 생성/수정 폼에서 사용하는 값 모델입니다.
 * (뷰 렌더링 시 사용)
 */
export type BoardFormValue = {
    slug: string;
    name: string;
    description: string;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
};

/**
 * 어드민 유저 생성 폼에서 사용하는 값 모델입니다.
 * (뷰 렌더링 시 사용)
 */
export type UserCreateFormValue = {
    username: string;
    role: "user" | "admin";
    status: "active" | "inactive";
};
