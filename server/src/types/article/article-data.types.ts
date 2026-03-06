/**
 * 게시글(Article) DB row 타입 모음입니다.
 */

export type ArticleOutlineRow = {
  board_slug: string;
  display_id: number;
  user_id: number;
  title: string;
  author: string;
  created_at: Date;
};

export type ArticleRecordRow = {
  post_id: number;
  board_id: number;
  board_slug: string;
  board_name: string;
  display_id: number;
  user_id: number;
  title: string;
  content: string;
  image_url: string | null;
  file_url: string | null;
};

export type ArticleShowRow = {
  board_id: number;
  board_name: string;
  board_slug: string;
  display_id: number;
  user_id: number;
  title: string;
  username: string;
  content: string;
  image_url: string | null;
  file_url: string | null;
  created_at: Date;
  updated_at: Date | null;
};

export type NeighborPostRow = {
  display_id: number;
  title: string;
};
