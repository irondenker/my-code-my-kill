import type { RequestHandler } from 'express';
import { getSecurityDefenseOptions } from '../config/security-defense-options.js';
import { logRateLimitedSafely } from '../services/audit.service.js';
import { consumeFixedWindowRateLimit } from '../services/security-defense/rate-limit.service.js';
import { HttpError } from '../utils/http/http-error.js';
import { getRequestIp, getRequestUserAgent } from '../utils/http/request-meta.util.js';

export const enforcePostMutationRateLimit: RequestHandler = (req, _res, next) => {
  const rateLimitOptions = getSecurityDefenseOptions().rateLimit;
  if (!rateLimitOptions.enabled) {
    return next();
  }

  const actorUserId = typeof req.session.userId === 'number' ? req.session.userId : null;
  const actorUsername = typeof req.session.username === 'string' ? req.session.username : null;
  const ipAddress = getRequestIp(req);
  const keyType = actorUserId !== null ? 'user' : 'ip';
  const keyValue = actorUserId !== null ? String(actorUserId) : (ipAddress ?? 'unknown');
  const decision = consumeFixedWindowRateLimit({
    bucket: 'post-mutation',
    key: keyValue,
    maxRequests: rateLimitOptions.maxRequests,
    windowSeconds: rateLimitOptions.windowSeconds,
  });

  if (!decision.limited) {
    return next();
  }

  void logRateLimitedSafely({
    actorUserId,
    actorUsername,
    targetUserId: actorUserId,
    targetUsername: actorUsername,
    scope: 'post_mutation',
    keyType,
    maxRequests: rateLimitOptions.maxRequests,
    windowSeconds: rateLimitOptions.windowSeconds,
    retryAfterSeconds: decision.retryAfterSeconds,
    method: req.method,
    path: req.originalUrl,
    ipAddress,
    userAgent: getRequestUserAgent(req),
  });

  return next(new HttpError(429, 'Too many requests'));
};
