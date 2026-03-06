import type { AuditAction } from './audit-action.types.js';
import type {
  AuditActorFields,
  AuditDetailsField,
  AuditRequestMetaFields,
  AuditTargetFields,
} from './audit-common.types.js';

/**
 * 감사로그 쓰기 API 입력 타입입니다.
 */
export type AuditLogWriteParams = {
  action: AuditAction;
} & Partial<AuditActorFields & AuditTargetFields & AuditDetailsField & AuditRequestMetaFields>;

/**
 * 감사로그 쓰기 입력을 정규화한 내부 타입입니다.
 */
export type NormalizedAuditLogWriteInput = {
  action: AuditAction;
  detailsJson: string;
} & AuditActorFields &
  AuditTargetFields &
  AuditDetailsField &
  AuditRequestMetaFields;
