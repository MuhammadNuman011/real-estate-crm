require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const app = new express();
const Config = require("./config/config");
const db = require("./config/db");

app.use(express.json({ limit: "50mb" }));

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
