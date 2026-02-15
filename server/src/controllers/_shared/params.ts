import type { Request } from "express";
import { HttpError } from "../../utils/http-error.js";

/**
 * 컨트롤러 레이어에서 라우트 파라미터를 안전하게 파싱하기 위한 유틸입니다.
 *
 * - 컨트롤러 내에서 파라미터 파싱/검증 패턴을 반복하지 않기 위해 공통화합니다.
 * - 유효하지 않은 값은 404(Not Found)로 처리해 라우팅 수준의 실패로 취급합니다.
 */

/**
 * 라우트 파라미터를 문자열로 정규화(trim)하여 반환합니다.
 * 값이 비어 있으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
export function getStringParamOrThrow(req: Request, paramName: string): string {
    const value = String((req.params as Record<string, unknown>)[paramName] ?? "").trim();
    if (!value) {
        throw new HttpError(404, "Not Found");
    }
    return value;
}

/**
 * 라우트 파라미터를 양의 정수로 파싱하여 반환합니다.
 * 유효하지 않으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
export function getPositiveIntParamOrThrow(req: Request, paramName: string): number {
    const raw = (req.params as Record<string, unknown>)[paramName];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        throw new HttpError(404, "Not Found");
    }
    return Math.trunc(value);
}

