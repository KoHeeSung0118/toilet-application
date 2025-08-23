// util/database.ts
import clientPromise from '@/lib/mongodb';

// 기존 코드 호환: { connectDB }로 가져가면 됩니다.
export const connectDB = clientPromise;
