import type { Request, Response } from "express";
import { logLogoutSuccessSafely } from "../../services/audit.service.js";
import { getRequestIp, getRequestUserAgent } from "../../utils/http/request-meta.util.js";
import { clearAuthSession } from "../../utils/session/auth-session.util.js";
import { getSessionActor } from "../../utils/session/session-actor.util.js";
import { SESSION_COOKIE_NAME } from "../../constants/session.constants.js";

/**
 * 로그아웃 요청을 처리합니다.
 *
 * 처리:
 * - (가능한 경우) 로그아웃 감사로그 기록
 * - 세션 파기 및 쿠키 제거
 */
export async function postLogout(req: Request, res: Response) {
    const actor = getSessionActor(req);
    const role = req.session.userRole;
    const ipAddress = getRequestIp(req);
    const userAgent = getRequestUserAgent(req);

    if (actor.userId !== null) {
        await logLogoutSuccessSafely({
            userId: actor.userId,
            username: actor.username,
            userRole: role ?? null,
            ipAddress,
            userAgent,
        });
    }

    await clearAuthSession(req);
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.redirect("/");
}
