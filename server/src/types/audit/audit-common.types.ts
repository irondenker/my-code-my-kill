/**
 * 감사로그에서 공통으로 사용하는 actor 필드입니다.
 */
export type AuditActorFields = {
  actorUserId: number | null;
  actorUsername: string | null;
};

/**
 * 감사로그에서 공통으로 사용하는 target 필드입니다.
 */
export type AuditTargetFields = {
  targetUserId: number | null;
  targetUsername: string | null;
};

/**
 * 감사로그에서 공통으로 사용하는 details 필드입니다.
 */
export type AuditDetailsField = {
  details: Record<string, unknown>;
};

/**
 * 감사로그에서 공통으로 사용하는 요청 메타(IP/UA) 필드입니다.
 */
export type AuditRequestMetaFields = {
  ipAddress: string | null;
  userAgent: string | null;
};

/**
 * 감사로그에서 HTTP 컨텍스트와 함께 쓰는 요청 메타 필드입니다.
 */
export type AuditHttpRequestMetaFields = AuditRequestMetaFields & {
  method: string;
  path: string;
};
