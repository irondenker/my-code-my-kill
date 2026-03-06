import type { Request } from 'express';
import { HttpError } from './http-error.js';

/**
 * 라우트 파라미터를 문자열로 정규화(trim)하여 반환합니다.
 * 값이 비어 있으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
export function getStringParamOrThrow(req: Request, paramName: string): string {
  const value = String((req.params as Record<string, unknown>)[paramName] ?? '').trim();
  if (!value) {
    throw new HttpError(404, 'Not Found');
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
    throw new HttpError(404, 'Not Found');
  }
  return Math.trunc(value);
}
