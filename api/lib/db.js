const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable inside your configuration.');
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  // If we already have a connection cached, reuse it
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri);

  // Connect to the client
  await client.connect();
  
  // Extract database name from connection string or default to 'healthverse'
  let dbName = 'healthverse';
  try {
    const url = new URL(uri);
    const pathDb = url.pathname.substring(1);
    if (pathDb) {
      dbName = pathDb.split('?')[0]; // strip query params if any
    }
  } catch (err) {
    console.error('Failed to parse database name from URI, using default:', err);
  }

  const db = client.db(dbName);

  // Cache client and db
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

module.exports = { connectToDatabase };
