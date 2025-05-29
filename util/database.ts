import { MongoClient } from 'mongodb';

const url = process.env.MONGODB_URI!; // 실제 URI로 바꿔줘!
let connectDB: Promise<MongoClient>;

declare global {
  var _mongo: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongo) {
    global._mongo = new MongoClient(url).connect(); // ✅ 옵션 없이 사용
  }
  connectDB = global._mongo;
} else {
  connectDB = new MongoClient(url).connect();
}

export { connectDB };

