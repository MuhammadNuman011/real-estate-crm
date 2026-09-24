const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define("Comapnies", {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  adminid: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  mobile: Sequelize.STRING,
  status: {
    type: Sequelize.ENUM("inactive", "active"),
    allowNull: false,
    defaultValue: "inactive"
  }
}, {
  defaultScope: {
    attributes: {
      exclude: ["password"]
    }
  }
});
