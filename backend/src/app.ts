import express from "express";

export function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.use(express.static("public"));

  // 라우트 정의
  app.get('/login', function (req, res) {
    res.render('auth/sign-in');
  });

  // 라우트 정의
  app.get('/', function (req, res) {
    res.render('index');
  });

  return app;
}
