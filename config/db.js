const Sequelize = require("sequelize");
const config = require("./config");

const db = new Sequelize(config.dbURI, { logging:  false });
// var db = new Sequelize("database_users2", "root", "admin12345", {
//   host: "localhost",
//   dialect: "mysql",

//   pool: {
//     max: 5,
//     min: 0,
//     idle: 10000
//   }
// });

db.authenticate()
  .then(function() {
    console.log("Database connected successfully.");
  })
  .catch(function(err) {
    console.log("Database connection failed.");
    console.log(err);
  });

module.exports = db;
