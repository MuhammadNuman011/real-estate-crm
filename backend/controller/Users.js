const Users = require("../modals/Users");

module.exports = function(app) {
  
  app.get("/health", function(req, res) {
    res.status(200).json({ status: "ok" });
  });

  app.get("/users", async function(req, res) {
    try {
      const users = await Users.findAll();
      return res.status(200).json(users);
    } catch (error) {
      console.error("Get users failed:", error);
      return res.status(500).json({ error: "Unable to retrieve users." });
    }
  });

  app.post("/users", async function(req, res) {
    try {
      const user = await Users.create({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email
      });

      return res.status(201).json(user);
    } catch (error) {
      console.error("Signup failed:", error);
      return res.status(400).json({ error: "Unable to create user." });
    }
  });

  app.post("/auth/login", async function(req, res) {
    try {
      const user = await Users.findOne({
        where: {
          email: req.body.email
        }
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid email." });
      }

      return res.status(200).json({
        message: "User successfully logged in.",
        user
      });
    } catch (error) {
      console.error("Login failed:", error);
      return res.status(500).json({ error: "Unable to log in." });
    }
  });

  app.get("/users/:id", async function(req, res) {
    try {
      const user = await Users.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error("Get user failed:", error);
      return res.status(500).json({ error: "Unable to retrieve user." });
    }
  });

  app.patch("/users/:id", async function(req, res) {
    try {
      const user = await Users.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      await user.update({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email
      });

      return res.status(200).json(user);
    } catch (error) {
      console.error("Update user failed:", error);
      return res.status(400).json({ error: "Unable to update user." });
    }
  });

  app.delete("/users/:id", async function(req, res) {
    try {
      const deleted = await Users.destroy({
        where: {
          id: req.params.id
        }
      });

      if (!deleted) {
        return res.status(404).json({ error: "User not found." });
      }

      return res.status(204).send();
    } catch (error) {
      console.error("Delete user failed:", error);
      return res.status(500).json({ error: "Unable to delete user." });
    }
  });
};
