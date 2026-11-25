const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define(
  "Features",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    key: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },

    enabled: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    description: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "features",
    timestamps: true,
    underscored: true,
  }
);
