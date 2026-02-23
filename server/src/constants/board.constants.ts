/**
 * Board(게시판) 도메인에서 공통으로 쓰는 상수 모음입니다.
 *
 * 원칙:
 * - "정책/제약 값"은 이 파일에서 단일 소스로 관리합니다.
 * - 컨트롤러/서비스/유틸은 이 값을 import하여 사용합니다(매직 넘버 금지).
 */

/** 페이지네이션 기본 페이지 크기입니다. */
export const PAGINATION_DEFAULT_LIMIT = 10;

/** 게시글 목록 페이지에서 UI로 선택 가능한 페이지당 개수 옵션입니다. */
export const PAGINATION_LIMIT_OPTIONS = [10, 20, 30, 40, 50, 100] as const;

/**
 * 페이지네이션 최대 페이지 크기입니다.
 * 비정상적으로 큰 limit 요청(과도한 DB 부하/응답 지연)을 방지합니다.
 */
export const PAGINATION_MAX_LIMIT = 100;

/** 게시글 제목의 최대 길이(문자 수)입니다. */
export const BOARD_MAX_TITLE_LENGTH = 100;
