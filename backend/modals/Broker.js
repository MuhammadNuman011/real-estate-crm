const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define(
  "Brokers",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },

    mobile: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },

    profile_picture: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },

    status: {
      type: Sequelize.ENUM("active", "inactive", "blocked"),
      allowNull: false,
      defaultValue: "active",
    },

    company_id: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    license_number: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    bio: {
      type: Sequelize.TEXT,
      allowNull: true,
    },

    address: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    last_login_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "brokers",
    timestamps: true,
    underscored: true,
    defaultScope: {
      attributes: {
        exclude: ["password"],
      },
    },
  }
);