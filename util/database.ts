// util/database.ts
import path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('❌ MONGODB_URI is not set');

let connectDB: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongo: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongo) global._mongo = new MongoClient(uri).connect();
  connectDB = global._mongo;
} else {
  connectDB = new MongoClient(uri).connect();
}

export { connectDB };
