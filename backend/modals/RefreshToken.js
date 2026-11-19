const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define(
  "RefreshTokens",
  {
    jti: {
      type: Sequelize.STRING(36),
      primaryKey: true
    },
    role: {
      type: Sequelize.STRING(16),
      allowNull: false
    },
    subject_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    token_hash: {
      type: Sequelize.STRING(64),
      allowNull: false
    },
    expires_at: {
      type: Sequelize.DATE,
      allowNull: false
    },
    revoked_at: {
      type: Sequelize.DATE,
      allowNull: true
    },
    replaced_by: {
      type: Sequelize.STRING(36),
      allowNull: true
    }
  },
  {
    tableName: "refresh_tokens",
    indexes: [
      { fields: ["role", "subject_id"] }
    ]
  }
);
