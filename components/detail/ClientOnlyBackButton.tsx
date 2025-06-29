'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function ClientOnlyBackButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  const handleBack = () => {
    if (from) {
      const normalized = from.startsWith('/') ? from : `/${from}`;
      router.push(normalized); // ✅ 항상 절대 경로로 이동
    } else {
      router.back();
    }
  };

  return (
    <button onClick={handleBack} className="back-button">
      <ArrowLeft size={18} style={{ marginRight: '6px' }} />
      뒤로 가기
    </button>
  );
}
