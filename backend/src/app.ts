import express from "express";

export function createApp() {
  const app = express();

  app.set('view engine', 'ejs');

  // 데이터
  const data = {
    title: 'My EJS Website',
    message: 'Welcome to my website!'
  };

  // 라우트 정의
  app.get('/', function (req, res) {
    res.render('index', data);
  });

  return app;
}
