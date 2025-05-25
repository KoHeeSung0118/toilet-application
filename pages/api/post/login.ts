import { connectDB } from "@/util/database"
import bcrypt from 'bcrypt';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Post요청 아님' });
    }

    const { email, password } = req.body;


    const db = (await connectDB).db('toilet_app')
    const user = await db.collection('users').findOne({ email });

    if (!user) {
        return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
    }

    return res.status(200).rederect(302, '/')
}