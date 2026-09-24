const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define("Properties", {
  rent_sale: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  price: {
    type: Sequelize.INTEGER,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  checks: {
    type: Sequelize.NUMBER,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  bedrooms: Sequelize.NUMBER,
  washrooms: Sequelize.NUMBER,
  allowed_nationalities: Sequelize.NUMBER,
  status: {
    type: Sequelize.ENUM("inactive", "active"),
    allowNull: false,
    defaultValue: "inactive"
  },
  lat: Sequelize.STRING,
  long: Sequelize.STRING,
  description: Sequelize.STRING,
}, {
  // defaultScope: {
  //   attributes: {
  //     exclude: ["password"]
  //   }
  // }
});
