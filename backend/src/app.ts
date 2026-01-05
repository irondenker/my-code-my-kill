import express from "express";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/", (req, res) => {
    res.send("Hello from app.ts");
  });

  return app;
}
