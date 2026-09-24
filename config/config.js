const fileConfig = require("./" +
  (process.env.NODE_ENV || "development") +
  ".json");

if (!process.env.DB_URI) {
  throw new Error("DB_URI must be set in the environment.");
}

module.exports = {
  port: Number(process.env.PORT || fileConfig.port || 4000),
  dbURI: process.env.DB_URI
};
