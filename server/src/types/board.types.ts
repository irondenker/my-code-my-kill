// /**
//  * - **사용 용도**: 게시판 `글 목록` Pagination에 필요한 **데이터** 정의 
//  * - **Route**: `/board`
//  * @param {number} page 현재 페이지
//  * @param {string} totalPages 전체 페이지 수
//  * @param {string} totalCount 전체 게시글 수
//  * @param {Date} limit 페이지당 게시글 수 (초기 값: 10)
//  */
// export interface Pagination {
//   page?: number;
//   totalCount: number;
//   limit?: number;
// }


/**
 * - **사용 용도**: 게시판 `글 목록`표기에 사용, 각각 글마다 필요한 **메타데이터** 정의
 * - **Route**: `/board`
 * - 현재 사용처 없음
 * @param {string} boardSlug board slug
 * @param {number} displayId board display id
 * @param {string} title 글 제목
 * @param {string} author 글쓴이
 * @param {Date} createdAt 글 쓴 날짜
 */
export interface BoardPostOutline {
  boardSlug: string;
  displayId: number;
  title: string;
  author: string;
  createdAt: Date;
}
