// components/detail/ClientOnlyBackButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react'; // 아이콘

export default function ClientOnlyBackButton() {
  const router = useRouter();

  return (
    <button onClick={() => router.back()} className="back-button">
      <ArrowLeft size={18} style={{ marginRight: '6px' }} />
      뒤로 가기
    </button>
  );
}
