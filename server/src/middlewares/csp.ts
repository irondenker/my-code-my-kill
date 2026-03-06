import type { RequestHandler } from 'express';
import crypto from 'node:crypto';

export function createCspMiddleware(params?: {
  reportOnly?: boolean;
  // 필요하면 여기서 allowlist 추가 (예: analytics, CDN 등)
}): RequestHandler {
  const reportOnly = params?.reportOnly ?? false;

  return (req, res, next) => {
    const nonce = crypto.randomBytes(16).toString('base64');

    // EJS에서 쓸 수 있게 내려줌
    res.locals.cspNonce = nonce;

    // 기본 CSP 정책(출발점)
    // - script-src: 'self' + nonce
    // - object-src: 'none' (플러그인 차단)
    // - base-uri, frame-ancestors 등 기본 하드닝
    const csp = [
      `default-src 'self'`,
      `base-uri 'self'`,
      `object-src 'none'`,
      `frame-ancestors 'none'`,
      `form-action 'self'`,
      `img-src 'self' data: blob:`,
      `font-src 'self' data:`,
      // Bootstrap/일반 CSS 상황에선 style-src가 문제될 수 있어 일단 'unsafe-inline' 허용을 추천(나중에 nonce로 강화 가능)
      `style-src 'self'`,
      `script-src 'self' 'nonce-${nonce}'`,
      // 필요 시 fetch/websocket 열어주기
      `connect-src 'self'`,
      // 원하면 아래도 추가 가능
      // `upgrade-insecure-requests`,
    ].join('; ');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
      csp
    );

    next();
  };
}
