// // pages/api/toilet/[id]/my-rating.ts
// import { NextApiRequest, NextApiResponse } from 'next';
// import { connectDB } from '@/util/database';
// import { ObjectId } from 'mongodb';
// import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI'; // JWT 파싱 함수

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method !== 'GET') return res.status(405).end();

//   const db = (await connectDB).db('toilet');
//   const userId = await getUserFromTokenInAPI(req);

//   if (!userId) return res.status(401).json({ message: '로그인 필요' });

//   const rating = await db.collection('ratings').findOne({
//     toiletId: id,
//     userId: userId,
//   });

//   if (!rating) return res.status(200).json({});
//   return res.status(200).json({
//     overall: rating.overall,
//     cleanliness: rating.cleanliness,
//     facility: rating.facility,
//     convenience: rating.convenience,
//   });
// }
