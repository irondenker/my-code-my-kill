import { MOCK_POSTS } from "../mocks/posts.mock.ts";

export async function countBoardPosts(): Promise<number> {
    // // DB(Sequelize)를 통한 통신이 필요한 구간
    // const totalCount = await Post.count();

    // 다만, 현재는 DB 미구현 상태이므로 Mocks 데이터로 대체
    const totalCount = MOCK_POSTS.length;

    return totalCount;
}

// API 구조 미완성으로 인해 해당 기능 타입 추론으로 남겨놓음
// 추후 API Docs 완성 혹은 안정화 시 타입 지정 필요
export async function listBoardPostOutlines(params: {
    offset: number,
    limit: number
}) {
    // 사용하기 편하도록 입력값 분리
    const { offset, limit } = params;

    // // DB(Sequelize)를 통한 통신이 필요한 구간
    // const posts = await Post.findAll({ limit, offset });

    // 다만, 현재는 DB 미구현 상태이므로 Mocks 데이터로 대체
    const postOutlines = MOCK_POSTS.slice(offset, offset + limit);

    return postOutlines;
}