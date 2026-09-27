const Brokers = require("../modals/Broker");
const { readBearerToken, verifyCompanyToken } = require("../helpers/token");

async function requireBrokerAuth(req, res, next) {
  try {
    const token = readBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    let payload;
    try {
      payload = verifyCompanyToken(token);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }

      return res.status(401).json({ error: "Invalid or missing authentication token." });
    }

    if (!payload || payload.role !== "broker" || !payload.brokerId) {
      return res.status(403).json({ error: "You do not have access to this module." });
    }

    const broker = await Brokers.findByPk(payload.brokerId);
    if (!broker) {
      return res.status(401).json({ error: "Invalid or missing authentication token." });
    }

    if (broker.status !== "active") {
      return res.status(403).json({ error: "Broker account is inactive." });
    }

    req.broker = broker;
    return next();
  } catch (error) {
    console.error("Broker authentication failed:", error);
    return res.status(500).json({ error: "Unable to authenticate." });
  }
}

module.exports = requireBrokerAuth;
