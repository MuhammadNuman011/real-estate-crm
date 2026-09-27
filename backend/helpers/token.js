const jwt = require("jsonwebtoken");
const Config = require("../config/config");

function createCompanyToken(company) {
  return jwt.sign(
    {
      role: "company",
      companyId: company.id,
      adminid: company.adminid
    },
    Config.jwtSecret,
    {
      expiresIn: Config.jwtExpiresIn
    }
  );
}

function createBrokerToken(broker) {
  return jwt.sign(
    {
      role: "broker",
      brokerId: broker.id
    },
    Config.jwtSecret,
    {
      expiresIn: Config.jwtExpiresIn
    }
  );
}

function readBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const parts = authorizationHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return null;
  }

  return parts[1];
}

function verifyCompanyToken(token) {
  return jwt.verify(token, Config.jwtSecret);
}

module.exports = {
  createCompanyToken,
  createBrokerToken,
  readBearerToken,
  verifyCompanyToken
};
