import type { Request } from "express";

/**
 * 세션 플래시 메시지 키입니다.
 * (한 번 소비하면 삭제되는 문자열 필드)
 */
export type SessionFlashKey = "boardFlashMessage" | "adminUsersFlashMessage" | "adminBoardsFlashMessage";

/**
 * 플래시 메시지를 1회 소비합니다.
 * 값이 없거나 빈 문자열이면 null을 반환합니다.
 */
export function consumeSessionFlashMessage(req: Request, key: SessionFlashKey): string | null {
    const value = req.session[key];
    if (typeof value !== "string" || value.length === 0) {
        return null;
    }
    delete req.session[key];
    return value;
}

/**
 * 플래시 메시지를 저장합니다.
 */
export function setSessionFlashMessage(req: Request, key: SessionFlashKey, message: string) {
    req.session[key] = message;
}
