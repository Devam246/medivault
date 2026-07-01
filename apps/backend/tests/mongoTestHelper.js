import { MongoMemoryServer } from "mongodb-memory-server";
import { closeMongo, getMongoDb, ensureMongoIndexes } from "../src/config/mongo.js";

let mongoServer;

export async function startMongoTestServer() {
  // Override environment configuration
  process.env.DATA_STORE = "mongo";
  process.env.NODE_ENV = "test";
  
  // Disable logging config errors by setting dummy variables
  process.env.JWT_SECRET = "testsecret";
  process.env.DB_PASS = "testdbpass";
  process.env.PRIVATE_KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.GROQ_API_KEY = "testgroqkey";

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.MONGO_DB_NAME = "medivault-test";

  // Establish connection and run migrations (indexes)
  await getMongoDb();
  await ensureMongoIndexes();
}

export async function stopMongoTestServer() {
  await closeMongo();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearDatabase() {
  const db = await getMongoDb();
  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    await db.collection(collection.name).deleteMany({});
  }
}
