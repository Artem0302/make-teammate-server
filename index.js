const { MongoClient } = require("mongodb");
const { apiProvider } = require("./src/api");

// Connection URI
const uri =
  "mongodb+srv://artem:2003Artem13@make-teammate.esoeb06.mongodb.net/?retryWrites=true&w=majority&appName=make-teammate";

// Database and collection name
const dbName = "make-teammate";

async function startServer() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to the database");

    const db = client.db(dbName);

    apiProvider(db);
  } catch (err) {
    console.error("Failed to connect to the database", err);
  }
}

startServer();
