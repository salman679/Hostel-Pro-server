const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@salman.uweo3xy.mongodb.net/?retryWrites=true&w=majority&appName=Salman`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //collections
    const usersCollection = client.db("HostelPro").collection("users");
    const mealsCollection = client.db("HostelPro").collection("meals");
    const reviewsCollection = client.db("HostelPro").collection("reviews");

    //jwt related apis
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    //user related apis
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const { search } = req.query;

      let query = {};
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        };
      }

      try {
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch users" });
      }
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      //if user already added
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already added" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    //meals related apis
    app.get("/meals", async (req, res) => {
      const sortBy = req.query.sortBy;

      try {
        let meals;

        if (sortBy === "reviews_count") {
          meals = await mealsCollection
            .aggregate([
              {
                $addFields: {
                  reviews_count: { $size: "$reviews" },
                },
              },
              {
                $sort: { reviews_count: -1 },
              },
            ])
            .toArray();
        } else if (sortBy) {
          meals = await mealsCollection
            .find()
            .sort({ [sortBy]: -1 })
            .toArray();
        } else {
          meals = await mealsCollection.find().toArray();
        }

        res.send(meals);
      } catch (error) {
        console.error("Error fetching meals:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });

    app.get("/meals/category/:category", async (req, res) => {
      const category = req.params.category;
      console.log(`Fetching meals for category: ${category}`); // Debugging log

      const query = category !== "All" ? { category } : {}; // Adjust query for 'All' category
      try {
        const result = await mealsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching meals:", error);
        res.status(500).send("Error fetching meals");
      }
    });

    app.post("/meals", async (req, res) => {
      const meal = req.body;
      const result = await mealsCollection.insertOne(meal);
      res.send(result);
    });

    app.put("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const { title, likes, rating, distributorName } = req.body;

      // Build update object only with provided fields
      const updateDoc = { $set: { title, likes, rating, distributorName } };

      // Remove any undefined fields
      Object.keys(updateDoc.$set).forEach(
        (key) => updateDoc.$set[key] === undefined && delete updateDoc.$set[key]
      );

      if (Object.keys(updateDoc.$set).length === 0)
        return res.status(400).send({ message: "No fields to update" });

      try {
        const filter = { _id: new ObjectId(id) };
        const result = await mealsCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount === 0)
          return res.status(404).send({ message: "Meal not found" });

        res.send({ message: "Meal updated successfully" });
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/meals/reviews", async (req, res) => {
      const sortBy = req.query.sortBy;

      try {
        const reviews = await reviewsCollection
          .find()
          .sort({ [sortBy]: -1 })
          .toArray();

        res.send(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.delete("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
