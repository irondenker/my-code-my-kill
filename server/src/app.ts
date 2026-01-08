import express from "express";
import boardRouter from './routes/board.routes.ts';
import authRouter from './routes/auth.routes.ts';
import rootRouter from './routes/root.routes.ts'
import { errorHandler } from "./middlewares/error-handler.ts";

export function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.use(express.static("public"));

  app.use(authRouter);

  app.use(boardRouter);

  // Root index Page (End Of Router)
  app.use('/', rootRouter);

  // 에러 핸들러는 무조건 맨 마지막에
  app.use(errorHandler);

  return app;
}
