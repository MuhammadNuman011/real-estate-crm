const requireBrokerAuth = require("./requireBrokerAuth");
const { BROKER_MANAGE_PROPERTIES, isFeatureEnabled } = require("../helpers/features");

function requireBrokerPropertyWrite(req, res, next) {
  requireBrokerAuth(req, res, async function() {
    try {
      if (!req.broker.company_id) {
        return res.status(403).json({ error: "You do not have access to this module." });
      }

      const enabled = await isFeatureEnabled(BROKER_MANAGE_PROPERTIES);
      if (!enabled) {
        return res.status(403).json({ error: "You do not have access to this module." });
      }

      return next();
    } catch (error) {
      console.error("Property permission check failed:", error);
      return res.status(500).json({ error: "Unable to authenticate." });
    }
  });
}

module.exports = requireBrokerPropertyWrite;
