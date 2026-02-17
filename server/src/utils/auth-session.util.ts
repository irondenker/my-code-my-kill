import type { Request } from "express";
import type { UserRole } from "../types/user-role.types.js";
import { destroySession, regenerateSession, saveSession } from "./session.util.js";

/**
 * 인증 세션에 저장하는 핵심 사용자 정보입니다.
 */
export type AuthSessionPayload = {
    userId: number;
    userRole: UserRole;
    username: string;
    profileImageUrl: string | null;
};

/**
 * 로그인/회원가입 성공 시 세션을 재발급하고 인증 필드를 동기화합니다.
 *
 * 순서:
 * 1) regenerate (session fixation 완화)
 * 2) 인증 필드 기록
 * 3) save
 */
export async function establishAuthSession(req: Request, payload: AuthSessionPayload): Promise<void> {
    await regenerateSession(req);
    req.session.userId = payload.userId;
    req.session.userRole = payload.userRole;
    req.session.username = payload.username;
    req.session.profileImageUrl = payload.profileImageUrl;
    await saveSession(req);
}

/**
 * 로그아웃 시 서버 세션을 파기합니다.
 */
export function clearAuthSession(req: Request): Promise<void> {
    return destroySession(req);
}
