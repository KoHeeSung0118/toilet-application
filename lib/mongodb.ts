// lib/mongodb.ts
import { MongoClient, MongoClientOptions } from 'mongodb';
import dns from 'dns';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// IPv4 우선 (윈도우 SRV+IPv6 이슈 회피)
dns.setDefaultResultOrder?.('ipv4first');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is missing');

const isSrv = uri.startsWith('mongodb+srv://');

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 8000,
  // SRV 아닐 땐 TLS 명시
  ...(isSrv ? {} : { tls: true }),
  // 로컬 임시 우회(원할 때만 .env.local에 MONGODB_TLS_INSECURE=1)
  ...(process.env.MONGODB_TLS_INSECURE === '1'
    ? { tlsAllowInvalidCertificates: true, tlsAllowInvalidHostnames: true }
    : {}),
  appName: 'toilet-app',
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise!;
export default clientPromise;
