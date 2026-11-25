const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const app = new express();
const Config = require("./config/config");
const db = require("./config/db");

app.use(express.json({ limit: "96mb" }));
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

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

const Properties = require("./modals/Properties");
require("./modals/PropertyImage");
require("./modals/Feature");
const { ensureDefaultFeatures } = require("./helpers/features");

function ensurePropertyTitleColumn() {
  const table = Properties.getTableName();
  const tableName = typeof table === "string" ? table : table.tableName;
  return db.query("SHOW COLUMNS FROM `" + tableName + "` LIKE 'title'").then(function(result) {
    if (result[0].length) return null;
    return db.query("ALTER TABLE `" + tableName + "` ADD COLUMN `title` VARCHAR(255) NULL");
  });
}

function ensurePropertyImageColumn() {
  const table = Properties.getTableName();
  const tableName = typeof table === "string" ? table : table.tableName;
  return db.query("SHOW COLUMNS FROM `" + tableName + "` LIKE 'image'").then(function(result) {
    if (result[0].length) return null;
    return db.query("ALTER TABLE `" + tableName + "` ADD COLUMN `image` VARCHAR(255) NULL");
  });
}

function ensurePropertyBrochureColumns() {
  const table = Properties.getTableName();
  const tableName = typeof table === "string" ? table : table.tableName;
  return db.query("SHOW COLUMNS FROM `" + tableName + "` LIKE 'pdf_path'").then(function(result) {
    if (result[0].length) return null;
    return db.query(
      "ALTER TABLE `" + tableName + "` " +
      "ADD COLUMN `pdf_path` VARCHAR(255) NULL, " +
      "ADD COLUMN `pdf_generated_at` DATETIME NULL"
    );
  });
}

function ensurePropertyCreatorColumns() {
  const table = Properties.getTableName();
  const tableName = typeof table === "string" ? table : table.tableName;
  return db.query("SHOW COLUMNS FROM `" + tableName + "`").then(function(result) {
    const names = result[0].map(function(column) {
      return column.Field;
    });
    const statements = [];
    if (names.indexOf("created_by") === -1) {
      statements.push("ADD COLUMN `created_by` VARCHAR(255) NULL");
    }
    if (names.indexOf("created_by_role") === -1) {
      statements.push("ADD COLUMN `created_by_role` ENUM('company', 'broker') NULL");
    }
    if (!statements.length) return null;
    return db.query("ALTER TABLE `" + tableName + "` " + statements.join(", "));
  });
}

function ensureContractTenantColumn() {
  return db.query("SHOW COLUMNS FROM `property_contracts` LIKE 'tenant_id'").then(function(result) {
    const column = result[0][0];
    return db.query("SELECT COUNT(*) AS total FROM `property_contracts`").then(function(countResult) {
      const total = Number(countResult[0][0].total);
      if (!column) {
        const definition = total === 0 ? "INTEGER NOT NULL" : "INTEGER NULL";
        return db.query("ALTER TABLE `property_contracts` ADD COLUMN `tenant_id` " + definition + " AFTER `owner_id`");
      }
      if (column.Null === "YES" && total === 0) {
        return db.query("ALTER TABLE `property_contracts` MODIFY `tenant_id` INTEGER NOT NULL");
      }
      return null;
    });
  });
}

db.sync().then(function() {
  const table = Properties.getTableName();
  const tableName = typeof table === "string" ? table : table.tableName;
  return db.query(
    "ALTER TABLE `" + tableName + "` MODIFY `status` ENUM('inactive', 'active', 'rented') NOT NULL DEFAULT 'inactive'"
  ).catch(function(err) {
    console.log("Unable to update property status values.");
    console.log(err);
  }).then(ensureContractTenantColumn).then(ensurePropertyTitleColumn).then(ensurePropertyImageColumn).then(ensurePropertyBrochureColumns).then(ensurePropertyCreatorColumns).then(ensureDefaultFeatures);
}).catch(function(err) {
  console.log("Unable to prepare property tables.");
  console.log(err);
});

app.listen(port, "0.0.0.0", function() {
  console.log("Server running on port " + port);
});
