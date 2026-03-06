type RateLimitCounter = {
  windowStartedAt: number;
  count: number;
};

const rateLimitCounterMap = new Map<string, RateLimitCounter>();

function maybeCleanupExpiredEntries() {
  // 단순 in-memory 구현이므로 맵이 커지는 경우에만 정리합니다.
  if (rateLimitCounterMap.size < 10_000) {
    return;
  }

  const now = Date.now();
  for (const [key, counter] of rateLimitCounterMap.entries()) {
    // 충분히 오래된 카운터는 제거합니다.
    if (now - counter.windowStartedAt > 15 * 60_000) {
      rateLimitCounterMap.delete(key);
    }
  }
}

export function consumeFixedWindowRateLimit(params: {
  bucket: string;
  key: string;
  maxRequests: number;
  windowSeconds: number;
}): {
  limited: boolean;
  retryAfterSeconds: number;
  currentCount: number;
} {
  const maxRequests = Math.max(1, Math.trunc(params.maxRequests));
  const windowMs = Math.max(1, Math.trunc(params.windowSeconds)) * 1_000;
  const now = Date.now();
  const counterKey = `${params.bucket}:${params.key}`;
  const existing = rateLimitCounterMap.get(counterKey);

  if (!existing || now - existing.windowStartedAt >= windowMs) {
    rateLimitCounterMap.set(counterKey, {
      windowStartedAt: now,
      count: 1,
    });
    maybeCleanupExpiredEntries();
    return {
      limited: false,
      retryAfterSeconds: Math.ceil(windowMs / 1_000),
      currentCount: 1,
    };
  }

  if (existing.count >= maxRequests) {
    const retryAfterMs = windowMs - (now - existing.windowStartedAt);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1_000)),
      currentCount: existing.count,
    };
  }

  existing.count += 1;
  rateLimitCounterMap.set(counterKey, existing);
  return {
    limited: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowMs - (now - existing.windowStartedAt)) / 1_000)
    ),
    currentCount: existing.count,
  };
}
