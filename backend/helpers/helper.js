const { promisify } = require("util");
const crypto = require("crypto");
const Companies = require("../modals/Comapnies");
const Brokers = require("../modals/Broker");

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return "scrypt$" + salt + "$" + hash.toString("hex");
}

async function passwordMatches(password, storedPassword) {
  const parts = typeof storedPassword === "string" ? storedPassword.split("$") : [];
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const expectedHash = Buffer.from(parts[2], "hex");
  if (!expectedHash.length) {
    return false;
  }

  const actualHash = await scrypt(password, parts[1], expectedHash.length);
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

async function authenticateCompany(adminid, password) {
  const company = await Companies.unscoped().findOne({
    where: { adminid: adminid }
  });

  if (!company) {
    return { company: null, isPasswordValid: false };
  }

  return {
    company: company,
    isPasswordValid: await passwordMatches(password, company.password)
  };
}

async function authenticateBroker(email, password) {
  const broker = await Brokers.unscoped().findOne({
    where: { email: email }
  });

  if (!broker) {
    return { broker: null, isPasswordValid: false };
  }

  return {
    broker: broker,
    isPasswordValid: await passwordMatches(password, broker.password)
  };
}

module.exports = {
  hashPassword,
  authenticateCompany,
  authenticateBroker
};
