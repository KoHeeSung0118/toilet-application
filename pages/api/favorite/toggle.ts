import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
    }

    const { toiletId, toilet } = req.body;
    const token = req.cookies.token;
    console.log('💾 저장 시도 중 toilet:', toilet);
    if (!token) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const JWT_SECRET = process.env.JWT_SECRET!;
    let userId: string;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        userId = decoded.userId;
    } catch (error) {
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }

    const db = (await connectDB).db('toilet_app');
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const isFavorite = user.favorites?.includes(toiletId) ?? false;

    if (isFavorite) {
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $pull: { favorites: toiletId } }
        );
    } else {
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $addToSet: { favorites: toiletId } }
        );

        // 💾 화장실 정보 저장
        const exists = await db.collection('toilets').findOne({ id: toiletId });
        if (!exists && toilet) {
            await db.collection('toilets').insertOne(toilet);
        }
    }

    res.status(200).json({ isFavorite: !isFavorite });
}
