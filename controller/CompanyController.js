const Companies = require("../modals/Comapnies");
const { hashPassword, authenticateCompany } = require("../helpers/helper");
const { createCompanyToken } = require("../helpers/token");
const requireCompanyAuth = require("../middleware/requireCompanyAuth");

function serializeCompany(company) {
  const data = company.toJSON();
  delete data.password;
  return data;
}

module.exports = function(app) {

  app.get("/api/company", requireCompanyAuth, async function(req, res) {
    try {
      const companies = await Companies.findAll();
      return res.status(200).json(companies);
    } catch (error) {
      console.error("Get companies failed:", error);
      return res.status(500).json({ error: "Unable to retrieve Companies." });
    }
  });

  app.post("/api/company", async function(req, res) {
    try {
      const body = req.body || {};
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const adminid = typeof body.adminid === "string" ? body.adminid.trim() : "";

      const errors = {};
      if (!name) errors.name = "Name is required.";
      if (!adminid) errors.adminid = "Admin ID is required.";
      if (!email) {
        errors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = "Email must be valid.";
      }
      if (!password) {
        errors.password = "Password is required.";
      } else if (password.length < 8) {
        errors.password = "Password must be at least 8 characters long.";
      }

      if (Object.keys(errors).length) {
        return res.status(422).json({ error: "Validation failed.", fields: errors });
      }

      const registeredCompany = await Companies.findOne({
        where: { email: email }
      });

      if (registeredCompany) {
        return res.status(409).json({ error: "Email is already registered." });
      }

      const company = await Companies.create({
        name: name,
        email: email,
        password: await hashPassword(password),
        adminid: adminid,
        mobile: typeof body.mobile === "string" ? body.mobile.trim() : undefined
      });

      return res.status(201).json(serializeCompany(company));
    } catch (error) {
      console.error("Company register  failed:", error);

      if (error.name === "SequelizeUniqueConstraintError") {
        if (error.errors && error.errors[0] && error.errors[0].path === "adminid") {
          return res.status(409).json({ error: "Admin ID is already registered." });
        }
        return res.status(409).json({ error: "Email is already registered." });
      }

      return res.status(400).json({ error: "Unable to create company." });
    }
  });

  app.post("/api/company/login", async function(req, res) {
    try {
      const body = req.body || {};
      const adminid = typeof body.adminid === "string"
        ? body.adminid.trim()
        : (typeof body.username === "string" ? body.username.trim() : "");
      const password = typeof body.password === "string" ? body.password : "";

      if (!adminid || !password) {
        return res.status(422).json({
          error: "Validation failed.",
          fields: {
            ...(!adminid ? { adminid: "Admin ID is required." } : {}),
            ...(!password ? { password: "Password is required." } : {})
          }
        });
      }

      const authentication = await authenticateCompany(adminid, password);
      if (!authentication.company || !authentication.isPasswordValid) {
        return res.status(401).json({ error: "Invalid admin ID or password." });
      }

      if (authentication.company.status !== "active") {
        return res.status(403).json({ error: "Company account is inactive." });
      }

      return res.status(200).json({
        message: "Company successfully logged in.",
        token: createCompanyToken(authentication.company),
        company: serializeCompany(authentication.company)
      });
    } catch (error) {
      console.error("Company login failed:", error);
      return res.status(500).json({ error: "Unable to log in." });
    }
  });
  

};
