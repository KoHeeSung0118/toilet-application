// scripts/fixWrongNames.ts
import { connectDB } from '@/util/database';

(async () => {
  const db  = (await connectDB).db('toilet_app');
  const col = db.collection('toilets');

  const { modifiedCount } = await col.updateMany(
    { place_name: /카페이름미정|이름 미정/ },
    { $set: { place_name: '이름 미정 화장실' } },
  );

  console.log(`정리 완료: ${modifiedCount}건 수정`);
  process.exit(0);
})();
