// mocks/posts.mock.ts
export const MOCK_POSTS = Array.from({ length: 87 }, (_, i) => ({
  postNo: 87 - i,
  title: `테스트 게시글 ${87 - i}`,
  author: "admin",
  createdAt: new Date(Date.now() - i * 1000 * 60),
}));