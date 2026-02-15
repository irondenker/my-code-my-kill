import type { Request } from "express";

/**
 * 요청에서 IP 주소를 추출/정규화합니다.
 *
 * @param req Express 요청 객체
 * @returns 공백 제거된 IP 문자열 또는 null
 */
export function getRequestIp(req: Request): string | null {
    const value = typeof req.ip === "string" ? req.ip.trim() : "";
    return value || null;
}

/**
 * 요청에서 User-Agent를 추출/정규화합니다.
 *
 * @param req Express 요청 객체
 * @returns 공백 제거된 User-Agent 문자열 또는 null
 */
export function getRequestUserAgent(req: Request): string | null {
    const value = req.get("user-agent");
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
}

