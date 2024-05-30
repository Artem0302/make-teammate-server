const express = require("express");
const { socketProvider } = require("./chat");

const app = express();

const collectionName = "user-locations";
const usersCollectionName = "users";

function apiProvider(db) {
  const collection = db.collection(collectionName);
  const usersCollection = db.collection(usersCollectionName);

  app.use(express.json());

  app.post("/save-location", async (req, res) => {
    const { email, location } = req.body;
    try {
      if (!email || !location) {
        return res
          .status(400)
          .json({ message: "Email and location are required" });
      }
      await collection.updateOne(
        { email: email },
        { $set: { location: location } },
        { upsert: true },
      );
      res.status(201).send("Location saved or updated successfully");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/get-locations", async (req, res) => {
    const email = req.query.email;
    try {
      if (!email) {
        return res
          .status(400)
          .json({ message: "Email query parameter is required" });
      }
      const locations = await collection
        .find({ email: { $ne: email } })
        .toArray();

      res.json(locations);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/my-location", async (req, res) => {
    const email = req.query.email;
    try {
      if (!email) {
        return res
          .status(400)
          .json({ message: "Email query parameter is required" });
      }
      const location = await collection.findOne({ email: email });
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/change-location", async (req, res) => {
    const { email, location } = req.body;
    try {
      if (!email || !location) {
        return res
          .status(400)
          .json({ message: "Email and location are required" });
      }
      const result = await collection.updateOne(
        { email: email },
        { $set: { location: location } },
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json({ message: "Location updated successfully" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/user-info", async (req, res) => {
    const { email } = req.query;
    try {
      if (!email) {
        return res
          .status(400)
          .json({ message: "Email query parameter is required" });
      }

      // Find the user by email
      const user = await usersCollection.findOne({ email: email });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return the user information
      const { url, name, birth } = user;
      res.json({ url, name, birth });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/user-avatar", async (req, res) => {
    const { email } = req.query;
    try {
      if (!email) {
        return res
          .status(400)
          .json({ message: "Email query parameter is required" });
      }

      // Find the user by email
      const user = await usersCollection.findOne({ email: email });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return the user information
      const { url } = user;
      res.json({ url });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  socketProvider(app, db);
}

module.exports = { apiProvider };
