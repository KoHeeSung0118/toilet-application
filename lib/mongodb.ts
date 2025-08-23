import { MongoClient } from 'mongodb';

declare global {
  // 런타임 전역에 연결 Promise 캐싱
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI!;
const options = { maxPoolSize: 10 };

// 이미 캐시가 있으면 재사용, 없으면 새로 연결 후 캐시
const clientPromise: Promise<MongoClient> =
  global._mongoClientPromise ??
  (global._mongoClientPromise = new MongoClient(uri, options).connect());

export default clientPromise;
