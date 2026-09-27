require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const app = new express();
const Config = require("./config/config");
const db = require("./config/db");

app.use(express.json({ limit: "50mb" }));

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

db.sync();

app.listen(port, function() {
  console.log("Server running on port " + port);
});
