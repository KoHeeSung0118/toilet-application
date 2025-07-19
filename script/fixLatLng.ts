// script/fixLatLng.ts
// 실행: npx ts-node -r dotenv/config --esm -- ./script/fixLatLng.ts

import 'dotenv/config';                   // .env.local 로드 (ts-node -r dotenv/config)
import { connectDB } from '../util/database';
import { setTimeout as wait } from 'timers/promises';

async function main() {
  console.log('📌 스크립트 시작: lat/lng 보강 작업을 시작합니다.');

  // DB 연결
  console.log('🔗 DB 연결 시도 중...');
  const client = await connectDB;
  const db = client.db('toilet_app');
  console.log('✅ DB 연결 성공');

  const col = db.collection('toilets');

  // 대상 문서 수 조회
  const query = {
    $or: [
      { lat: { $exists: false } },
      { lng: { $exists: false } },
      { lat: null },
      { lng: null },
      { lat: NaN as any },
      { lng: NaN as any },
    ],
  };
  const total = await col.countDocuments(query);
  console.log(`🔎 수정 대상 문서 수: ${total}건`);

  const cursor = col.find(query);
  let fixed = 0, skipped = 0;

  for await (const doc of cursor) {
    const { _id, id, place_name = '', x = '', y = '' } = doc as any;
    console.log(`⏳ 처리 중: id=${id}, place_name='${place_name}', x='${x}', y='${y}'`);

    // A) x·y 값이 이미 있으면 그대로 반영
    if (x && y) {
      await col.updateOne({ _id }, { $set: { lat: Number(y) || null, lng: Number(x) || null } });
      fixed++;
      console.log(`  ↪️ 좌표 업데이트 완료 (x, y 사용)`);
      continue;
    }

    // B) Kakao API 재조회
    const url =
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
        place_name || '화장실',
      )}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } });

    if (!res.ok) {
      console.error(`  ❗ Kakao API 오류 ${res.status}: ${res.statusText}`);
      skipped++;
      await wait(200);
      continue;
    }

    const { documents } = (await res.json()) as { documents: any[] };
    const found = documents.find(d => d.id === id) ?? documents[0];
    if (!found) {
      console.log(`  ❌ 좌표 못 찾음`);
      skipped++;
      await wait(200);
      continue;
    }

    await col.updateOne(
      { _id },
      {
        $set: {
          x: found.x,
          y: found.y,
          lat: Number(found.y) || null,
          lng: Number(found.x) || null,
          place_name: found.place_name || place_name,
          address_name: found.address_name ?? '',
          road_address_name: found.road_address_name ?? '',
        },
      },
    );
    fixed++;
    console.log(`  ↪️ Kakao 재조회로 업데이트 완료`);
    await wait(200);  // 0.2s 딜레이
  }

  console.log(`\n✅ 좌표 보강 완료: ${fixed}건 반영, ${skipped}건 스킵`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
