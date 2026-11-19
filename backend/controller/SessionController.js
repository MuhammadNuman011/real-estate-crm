const Companies = require("../modals/Comapnies");
const Brokers = require("../modals/Broker");
const { createCompanyToken, createBrokerToken } = require("../helpers/token");
const { beginRefresh, revokeRefreshToken } = require("../helpers/refreshSession");

function withoutPassword(record) {
  const data = record.toJSON();
  delete data.password;
  return data;
}

function refreshTokenFrom(req) {
  const body = req.body || {};
  return typeof body.refresh_token === "string" ? body.refresh_token : "";
}

async function openRefresh(req, role) {
  try {
    return await beginRefresh(refreshTokenFrom(req), role);
  } catch (error) {
    console.error(role + " refresh failed:", error);
    return { ok: false, status: 500, error: "Unable to refresh the session." };
  }
}

module.exports = function(app) {
  app.post("/api/company/refresh", async function(req, res) {
    const consumed = await openRefresh(req, "company");
    if (!consumed.ok) {
      return res.status(consumed.status || 401).json({
        error: consumed.error || "Invalid or missing refresh token."
      });
    }

    try {
      const company = await Companies.findByPk(consumed.subjectId);
      if (!company || company.status !== "active") {
        await consumed.abort();
        if (company && company.status !== "active") {
          return res.status(403).json({ error: "Company account is inactive." });
        }
        return res.status(401).json({ error: "Invalid or missing refresh token." });
      }

      const refreshToken = await consumed.finish();
      const accessToken = createCompanyToken(company);
      return res.status(200).json({
        message: "Session refreshed.",
        token: accessToken,
        access_token: accessToken,
        refresh_token: refreshToken,
        company: withoutPassword(company)
      });
    } catch (error) {
      if (typeof consumed.abort === "function") {
        await consumed.abort().catch(function() {});
      }
      console.error("Company refresh failed:", error);
      return res.status(500).json({ error: "Unable to refresh the session." });
    }
  });

  app.post("/api/company/logout", async function(req, res) {
    try {
      await revokeRefreshToken(refreshTokenFrom(req), "company");
      return res.status(200).json({ message: "Logged out." });
    } catch (error) {
      console.error("Company logout failed:", error);
      return res.status(500).json({ error: "Unable to log out." });
    }
  });

  app.post("/api/broker/refresh", async function(req, res) {
    const consumed = await openRefresh(req, "broker");
    if (!consumed.ok) {
      return res.status(consumed.status || 401).json({
        error: consumed.error || "Invalid or missing refresh token."
      });
    }

    try {
      const broker = await Brokers.findByPk(consumed.subjectId);
      if (!broker || broker.status !== "active") {
        await consumed.abort();
        if (broker && broker.status !== "active") {
          return res.status(403).json({ error: "Broker account is inactive." });
        }
        return res.status(401).json({ error: "Invalid or missing refresh token." });
      }

      const refreshToken = await consumed.finish();
      const accessToken = createBrokerToken(broker);
      return res.status(200).json({
        message: "Session refreshed.",
        token: accessToken,
        access_token: accessToken,
        refresh_token: refreshToken,
        broker: withoutPassword(broker)
      });
    } catch (error) {
      if (typeof consumed.abort === "function") {
        await consumed.abort().catch(function() {});
      }
      console.error("Broker refresh failed:", error);
      return res.status(500).json({ error: "Unable to refresh the session." });
    }
  });

  app.post("/api/broker/logout", async function(req, res) {
    try {
      await revokeRefreshToken(refreshTokenFrom(req), "broker");
      return res.status(200).json({ message: "Logged out." });
    } catch (error) {
      console.error("Broker logout failed:", error);
      return res.status(500).json({ error: "Unable to log out." });
    }
  });
};
