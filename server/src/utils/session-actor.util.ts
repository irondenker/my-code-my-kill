import type { Request } from "express";
import { HttpError } from "./http-error.js";
import { normalizeString } from "./string.util.js";

export type SessionActor = {
    userId: number | null;
    username: string | null;
};

function isValidSessionUserId(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * 세션에서 감사로그 actor 정보를 안전하게 추출합니다.
 * 유효하지 않은 값은 null로 정규화합니다.
 */
export function getSessionActor(req: Request): SessionActor {
    return {
        userId: isValidSessionUserId(req.session.userId) ? req.session.userId : null,
        username: normalizeString(req.session.username, null),
    };
}

/**
 * 인증이 필수인 흐름에서 세션 actor를 강제 조회합니다.
 * userId가 없으면 401을 던집니다.
 */
export function requireSessionActor(req: Request): { userId: number; username: string | null } {
    const actor = getSessionActor(req);
    if (actor.userId === null) {
        throw new HttpError(401, "Unauthorized");
    }
    return {
        userId: actor.userId,
        username: actor.username,
    };
}
