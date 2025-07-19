// util/database.ts
// 프로젝트 루트의 .env.local을 우선적으로 로드
import path from 'path';
import { config } from 'dotenv';

config({
  path: path.resolve(process.cwd(), '.env.local'),
  override: true,
});

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다');
}

let connectDB: Promise<MongoClient>;

declare global {
  var _mongo: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongo) {
    global._mongo = new MongoClient(uri).connect();
  }
  connectDB = global._mongo;
} else {
  connectDB = new MongoClient(uri).connect();
}

export { connectDB };
