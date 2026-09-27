const fileConfig = require("./" +
  (process.env.NODE_ENV || "development") +
  ".json");

if (!process.env.DB_URI) {
  throw new Error("DB_URI must be set in the environment.");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in the environment.");
}

module.exports = {
  port: Number(process.env.PORT || fileConfig.port || 4000),
  dbURI: process.env.DB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  frontendUrl: process.env.FRONTEND_URL
};
