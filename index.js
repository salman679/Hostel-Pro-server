const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://hostelpro-ed1bf.web.app",
      "https://hostelpro-ed1bf.firebaseapp.com",
      "https://hostel-pro-cateriing.vercel.app"
      ,
    ],
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
    // await client.connect();

    //collections
    const usersCollection = client.db("HostelPro").collection("users");
    const mealsCollection = client.db("HostelPro").collection("meals");
    const packagesCollection = client.db("HostelPro").collection("packages");
    const paymentCollection = client.db("HostelPro").collection("payments");
    const upcomingCollection = client.db("HostelPro").collection("newUpcoming");

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
    app.get("/users", verifyToken, async (req, res) => {
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

    //get individual user
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    // getting role
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const filter = { email };
      const user = await usersCollection.findOne(filter);

      res.send({ role: user?.role });
    });

    //admin
    app.get(
      "/users/admin/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    //add user
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

    //make admin
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

    //meals added by admin
    app.get("/meals/admin", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      const filter = { distributorEmail: email };
      const mealsLength = await mealsCollection.countDocuments(filter);
      const totalMeals = await mealsCollection.countDocuments();
      const totalUsers = await usersCollection.countDocuments();
      const totalUpcomingMeals = await upcomingCollection.countDocuments();
      const meals = await mealsCollection.find().toArray();
      const totalReviews = meals.reduce(
        (sum, meal) => sum + (meal.reviews ? meal.reviews.length : 0),
        0
      );
      res.send({
        mealsLength: mealsLength,
        totalMeals: totalMeals,
        totalUsers: totalUsers,
        totalUpcomingMeals: totalUpcomingMeals,
        totalReviews: totalReviews,
      });
    });

    // Cancel meal request
    app.put("/meals/:id", verifyToken, async (req, res) => {
      const id = req.params.id; // Meal ID from URL
      const { email: userEmail, status } = req.body;

      // Filter for finding the meal
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          "requests.$[request].status": status,
        },
      };

      // Specify the array filter to match the correct review
      const options = {
        arrayFilters: [
          { "request.userEmail": userEmail }, // Match reviews by userEmail
        ],
      };

      try {
        const result = await mealsCollection.updateOne(
          filter,
          updateDoc,
          options
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "An error occurred while updating the review status",
          error,
        });
      }
    });

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

    app.get("/all-meals", async (req, res) => {
      const { search, category, minPrice, maxPrice } = req.query;

      try {
        const query = {};

        // Search filter
        if (search) {
          query.title = { $regex: search, $options: "i" };
        }

        // Category filter (ensure it doesn't check for "All")
        if (category) {
          query.category = category;
        }

        // Price filter - Handle missing values properly
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
          query.price = {};
          if (!isNaN(minPrice)) {
            query.price.$gte = parseFloat(minPrice);
          }
          if (!isNaN(maxPrice)) {
            query.price.$lte = parseFloat(maxPrice);
          }
        }

        const meals = await mealsCollection.find(query).toArray();
        res.send(meals);
      } catch (error) {
        console.error("Error fetching meals:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/meals/:id", async (req, res) => {
      const id = req?.params?.id;

      if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid Meal ID" });
      }
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      
      if (!result) {
        console.log(`Meal not found with ID: ${id}`);
        return res.status(404).json({ error: "Meal not found", mealId: id });
      }
      
      res.send(result);
    });

    // Debug endpoint to check meal existence
    app.get("/debug/meals/:id", async (req, res) => {
      const id = req.params.id;
      
      try {
        // Check if ID is valid ObjectId format
        const isValidId = ObjectId.isValid(id);
        
        if (!isValidId) {
          return res.json({
            exists: false,
            error: "Invalid ObjectId format",
            mealId: id,
            isValidObjectId: false
          });
        }

        const query = { _id: new ObjectId(id) };
        const meal = await mealsCollection.findOne(query);
        
        // Get total count of meals for reference
        const totalMeals = await mealsCollection.countDocuments();
        
        res.json({
          exists: !!meal,
          mealId: id,
          isValidObjectId: true,
          totalMealsInDatabase: totalMeals,
          meal: meal ? { _id: meal._id, title: meal.title, likes: meal.likes, likedBy: meal.likedBy } : null
        });
      } catch (error) {
        res.status(500).json({ error: error.message, mealId: id });
      }
    });

    app.get("/meals/category/:category", async (req, res) => {
      const category = req.params.category;
      const { search } = req.query;

      const query = category !== "All" ? { category } : {};

      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

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

    //update a meal by ID
    app.put("/meals/:id/edit", async (req, res) => {
      const id = req.params.id;
      const updatedMeal = req.body;
      const result = await mealsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedMeal }
      );

      res.send(result);
    });

    //serve meals
    app.get("/serve-meals", async (req, res) => {
      const searchQuery = req.query.search; // Get search query from the request

      try {
        // MongoDB aggregation pipeline
        const result = await mealsCollection
          .aggregate([
            {
              $project: {
                _id: 1,
                image: 1,
                title: 1,
                requests: 1,
              },
            },
            {
              $unwind: "$requests", // Flatten the requests array
            },
            {
              $match: {
                // Match if search query is present
                $or: [
                  {
                    "requests.userName": { $regex: searchQuery, $options: "i" },
                  }, // Case-insensitive match for userName
                  {
                    "requests.userEmail": {
                      $regex: searchQuery,
                      $options: "i",
                    },
                  }, // Case-insensitive match for userEmail
                ],
              },
            },
          ])
          .toArray(); // Convert cursor to array

        res.send(result); // Send the filtered results
      } catch (error) {
        console.error("Error fetching meals:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //status change in serve meals
    app.put("/meals/:id/serve", async (req, res) => {
      const id = req.params.id;
      const { status, userEmail } = req.body;

      try {
        const result = await mealsCollection.updateOne(
          {
            _id: new ObjectId(id),
            "requests.userEmail": userEmail,
          },
          { $set: { "requests.$.status": status } }
        );

        res.send(result);
      } catch (error) {
        console.error("Error updating meal status:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //update in like of meals
    app.patch("/meals/:id/like", async (req, res) => {
      const id = req.params.id;
      const { userEmail, action } = req.body;

      // Validate required fields
      if (!userEmail || !action) {
        return res.status(400).send({ message: "userEmail and action are required" });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid meal ID format" });
      }

      try {
        const filter = { _id: new ObjectId(id) };
        console.log(`Looking for meal with ID: ${id}`);
        
        const meal = await mealsCollection.findOne(filter);
        console.log(`Meal found:`, meal ? 'Yes' : 'No');

        if (!meal) {
          return res.status(404).send({ 
            message: "Meal not found", 
            mealId: id,
            debug: "The meal with this ID does not exist in the database"
          });
        }

        // Check if user has already liked this meal
        const likedBy = meal.likedBy || [];
        const hasLiked = likedBy.includes(userEmail);

        if (action === 'like' && hasLiked) {
          return res.status(400).send({ message: "You have already liked this meal" });
        }

        let updateDoc;
        if (action === 'like' && !hasLiked) {
          // Add user to likedBy array and increment likes
          updateDoc = {
            $push: { likedBy: userEmail },
            $set: { likes: (meal.likes || 0) + 1 }
          };
        } else if (action === 'unlike' && hasLiked) {
          // Remove user from likedBy array and decrement likes
          updateDoc = {
            $pull: { likedBy: userEmail },
            $set: { likes: Math.max((meal.likes || 0) - 1, 0) }
          };
        } else {
          return res.status(400).send({ message: "Invalid action" });
        }

        const result = await mealsCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "Failed to update meal" });
        }

        res.send({ message: "Meal updated successfully", success: true });
      } catch (error) {
        console.error("Error updating meal like:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //request meal from user
    app.post("/meals/:id/request", async (req, res) => {
      const id = req.params.id;
      const { userName, userEmail, status } = req.body;

      try {
        const request = {
          userName,
          userEmail,
          status,
        };

        const query = { _id: new ObjectId(id) };
        const update = {
          $push: { requests: request },
        };

        const result = await mealsCollection.updateOne(query, update);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Get all requested meals for a user
    app.get("/user/:email/requests", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        // Fetch meals with user requests and all reviews
        const mealsWithRequests = await mealsCollection
          .find({ "requests.userEmail": email })
          .project({
            image: 1,
            title: 1,
            likes: 1,
            requests: { $elemMatch: { userEmail: email } },
            reviews: 1,
          })
          .toArray();

        res.send(mealsWithRequests);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "An error occurred while fetching data" });
      }
    });

    //add reviews of meals
    app.post("/meals/:id/reviews", async (req, res) => {
      const { userName, text, userEmail } = req.body;
      const mealId = req.params.id;

      try {
        const review = {
          userName,
          text,
          userEmail,
          date: new Date(),
        };

        const query = { _id: new ObjectId(mealId) };
        const update = {
          $push: { reviews: review },
        };

        const result = await mealsCollection.updateOne(query, update);

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //get reviews of meals for each user
    app.get("/meals/:email/reviews", verifyToken, async (req, res) => {
      const email = req.params.email;

      try {
        // Fetch meals with filtered user reviews
        const mealsWithReviews = await mealsCollection
          .find({ "reviews.userEmail": email })
          .project({
            image: 1,
            title: 1,
            likes: 1,
            "reviews.$": 1,
          })
          .toArray();

        res.send(mealsWithReviews);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "An error occurred while fetching data" });
      }
    });

    //edit reviews
    app.put("/meals/:id/reviews", async (req, res) => {
      const { id } = req.params;
      const { email, text } = req.body;

      const query = { _id: new ObjectId(id), "reviews.userEmail": email };
      const update = {
        $set: {
          "reviews.$.text": text,
        },
      };

      const result = await mealsCollection.updateOne(query, update);
      res.send(result);
    });

    //delete reviews
    app.delete("/meals/:id/reviews", async (req, res) => {
      const id = req.params.id;
      const { email } = req.query;

      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.updateOne(query, {
        $pull: { reviews: { userEmail: email } },
      });

      res.send(result);
    });

    //short by reviews
    app.get("/meals/reviews", async (req, res) => {
      try {
        const meals = await mealsCollection.find().toArray();
        const response = meals.map((meal) => ({
          meal_id: meal._id,
          title: meal.title,
          likes: meal.likes,
          reviews_count: meal.reviews ? meal.reviews.length : 0,
          reviews: meal.reviews || [],
        }));

        res.json({ success: true, data: response });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.delete("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await mealsCollection.deleteOne(query);

      res.send(result);
    });

    //upcoming meals
    app.get("/upcoming-meals", async (req, res) => {
      const sortBy = req.query.sortBy;

      try {
        const result = await upcomingCollection
          .find()
          .sort({ [sortBy]: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching meals:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //post upcoming meals
    app.post("/upcoming-meals", async (req, res) => {
      const meal = req.body;
      const result = await upcomingCollection.insertOne(meal);
      res.send(result);
    });

    //update likes of upcoming meals
    app.patch("/upcoming-meals/:id/like", async (req, res) => {
      const id = req.params.id;
      const { userEmail } = req.body; // Get the user email

      try {
        const filter = { _id: new ObjectId(id) };
        const meal = await upcomingCollection.findOne(filter);

        if (!meal) {
          return res.status(404).send("Meal not found");
        }

        if (meal.likedUsers && meal.likedUsers.includes(userEmail)) {
          return res.status(400).send("You have already liked this meal");
        }

        // Update likes and add user email to likedUsers array
        const updateDoc = {
          $set: { likes: (meal.likes || 0) + 1 },
          $push: { likedUsers: userEmail }, // Add user email to the likedUsers array
        };

        const result = await upcomingCollection.updateOne(filter, updateDoc);

        if (meal.likes + 1 >= 10) {
          await upcomingCollection.deleteOne(filter);
          await mealsCollection.insertOne(meal);
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    //delete upcoming meals
    app.delete("/upcoming-meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await upcomingCollection.deleteOne(query);
      res.send(result);
    });

    // Endpoint to fetch a random featured meal
    app.get("/featured-meal", async (req, res) => {
      try {
        // Count total meals
        const mealsCount = await mealsCollection.countDocuments();
        if (mealsCount === 0) {
          return res.status(404).send("No meals found");
        }
        
        // Generate random skip value
        const randomSkip = Math.floor(Math.random() * mealsCount);
        
        // Fetch one random meal using skip and limit
        const featuredMeal = await mealsCollection.find().skip(randomSkip).limit(1).toArray();
        
        if (featuredMeal.length === 0) {
          return res.status(404).send("No meals found");
        }
        
        res.send(featuredMeal[0]);
      } catch (error) {
        console.error("Error fetching featured meal:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //payment related apis
    app.get("/packages", async (req, res) => {
      const result = await packagesCollection.find().toArray();
      res.send(result);
    });

    app.get("/packages/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await packagesCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    //payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      // Validate price
      if (price === undefined || price === null || isNaN(price)) {
        return res.status(400).send({ error: "Invalid price provided." });
      }

      const amount = Math.round(price * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    //payment details post to database
    app.post("/payments", async (req, res) => {
      const paymentInfo = req.body;

      //update the user subscription in the database
      const filter = { email: paymentInfo.email };
      const update = { $set: { subscription: paymentInfo.subscription } };
      await usersCollection.updateOne(filter, update);
      const result2 = await paymentCollection.insertOne(paymentInfo);
      res.send(result2);
    });

    //payment all details by user
    app.get("/payment-history/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
