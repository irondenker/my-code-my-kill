import express from "express";
import { createPaginationMeta } from "./utils/board.util.ts";
import { countBoardPosts, listBoardPostOutlines } from "./services/board.service.ts";
import boardRouter from './routes/board.routes.ts';

export function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.use(express.static("public"));

  // 라우트 정의
  app.get('/login', function (req, res) {
    res.render('auth/sign-in');
  });

  // 라우트 정의
  app.get('/register', function (req, res) {
    res.render('auth/register');
  });

  // 라우트 정의
  // app.get('/board', async function (req, res) {
  //   try {
  //     //rawPage -> page 입력 값에 대한 최소한의 유효성 검사(validate 추가 필요)
  //     const rawPage = Number(req.query.page);
  //     const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  //     const totalCount = await countBoardPosts();

  //     const { totalPages, limit } = createPaginationMeta(totalCount)
  //     const offset = (page - 1) * limit;

  //     //목업 데이터 영역
  //     // const postOutlines = MOCK_POSTS.slice(offset, offset + limit);
  //     const postOutlines = await listBoardPostOutlines({
  //       offset,
  //       limit
  //     });


  //     res.render('board/index', {
  //       postOutlines,
  //       pagination: {
  //         page,
  //         totalPages,
  //         totalCount,
  //         limit,  //초기 값 === 10
  //       },
  //     });
  //   } catch (err) {
  //     throw err; // 손 볼 필요 있음
  //   }
  // });

  app.use(boardRouter);

  // 라우트 정의
  app.get('/', function (req, res) {
    res.render('index');
  });

  return app;
}
