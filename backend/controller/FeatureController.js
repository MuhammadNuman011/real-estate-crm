const Features = require("../modals/Feature");
const requireBrokerAuth = require("../middleware/requireBrokerAuth");

module.exports = function(app) {
  app.get("/api/broker/features", requireBrokerAuth, async function(req, res) {
    try {
      const rows = await Features.findAll({
        attributes: ["key", "enabled"],
        order: [["key", "ASC"]],
      });
      const features = {};
      rows.forEach(function(row) {
        features[row.key] = Boolean(row.enabled);
      });
      return res.status(200).json(features);
    } catch (error) {
      console.error("Get features failed:", error);
      return res.status(500).json({ error: "Unable to retrieve features." });
    }
  });
};
