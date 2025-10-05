const { MongoClient } = require("mongodb");

async function runMigration() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // Create indexes
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("profiles").createIndex({ user: 1 }, { unique: true });
    await db
      .collection("matches")
      .createIndex({ user1: 1, user2: 1 }, { unique: true });
    await db
      .collection("messages")
      .createIndex({ sender: 1, receiver: 1, timestamp: 1 });

    console.log("Migration completed successfully");
  } finally {
    await client.close();
  }
}

module.exports = runMigration;
