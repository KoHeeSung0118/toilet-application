import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: '허용되지 않은 요청입니다.' });

  try {
    const { id, place_name } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: '잘못된 ID입니다.' });
    }

    const db = (await connectDB).db('toilet_app');

    // ✅ 1. MongoDB에 이미 있는지 확인
    const existing = await db.collection('toilets').findOne({ kakaoId: id });
    if (existing) return res.status(200).json(existing);

    // ✅ 2. place_name 필수
    if (!place_name || typeof place_name !== 'string') {
      return res.status(400).json({ error: 'place_name이 필요합니다.' });
    }

    const decodedName = decodeURIComponent(place_name);

    // ✅ 3. 카카오 API 요청
    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(decodedName)}`,
      {
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        },
      }
    );


    const json = await kakaoRes.json();

    // ✅ 4. 응답 유효성 검사
    if (!json || !Array.isArray(json.documents)) {
      console.error('카카오 API 응답 이상:', json);
      return res.status(500).json({ error: '카카오 API 응답이 잘못되었습니다.' });
    }

    // ✅ 5. 해당 ID 찾기
    const found = json.documents.find((doc: any) => doc.id === id);

    if (!found) {
      return res.status(404).json({ error: '카카오에서 해당 화장실을 찾을 수 없습니다.' });
    }

    // ✅ 6. DB에 저장
    const newToilet = {
      kakaoId: id,
      place_name: found.place_name || '이름 없음',
      address: found.address_name || '주소 없음',
      rating: null,
      cleanliness: '정보 없음',
      facility: '정보 없음',
      convenience: '정보 없음',
      reviews: [],
    };

    await db.collection('toilets').insertOne(newToilet);
    return res.status(200).json(newToilet);

  } catch (error) {
    console.error('❌ 서버 오류:', error);
    return res.status(500).json({ error: '서버 오류 발생' });
  }
}
