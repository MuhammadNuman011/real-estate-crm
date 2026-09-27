const Companies = require("../modals/Comapnies");
const { readBearerToken, verifyCompanyToken } = require("../helpers/token");

async function requireCompanyAuth(req, res, next) {
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

    const companyId = payload && payload.companyId;
    if (!companyId) {
      return res.status(401).json({ error: "Invalid or missing authentication token." });
    }

    const company = await Companies.findByPk(companyId);
    if (!company) {
      return res.status(401).json({ error: "Invalid or missing authentication token." });
    }

    if (company.status !== "active") {
      return res.status(403).json({ error: "Company account is inactive." });
    }

    req.company = company;
    return next();
  } catch (error) {
    console.error("Company authentication failed:", error);
    return res.status(500).json({ error: "Unable to authenticate." });
  }
}

module.exports = requireCompanyAuth;
