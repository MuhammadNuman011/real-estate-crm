const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const app = new express();
const Config = require("./config/config");
const db = require("./config/db");

app.use(express.json({ limit: "50mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(function(req, res, next) {
  if (Config.frontendUrl) {
    res.setHeader("Access-Control-Allow-Origin", Config.frontendUrl);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const port = Config.port;

const controllersPath = path.join(__dirname, "controller");

fs.readdirSync(controllersPath)
  .filter(function(file) {
    return path.extname(file) === ".js";
  })
  .forEach(function(file) {
    require(path.join(controllersPath, file))(app);
  });

const frontendIndex = path.join(__dirname, "../frontend/dist/index.html");

if (fs.existsSync(frontendIndex)) {
  app.use(express.static(path.dirname(frontendIndex)));
  app.use(function(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path === "/health") {
      return next();
    }
    res.sendFile(frontendIndex);
  });
}

db.sync();

app.listen(port, "0.0.0.0", function() {
  console.log("Server running on port " + port);
});
