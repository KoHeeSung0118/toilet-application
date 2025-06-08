'use client';

import { useRouter } from 'next/navigation';

export default function Header() {
  const router = useRouter();

  const handleLogout = () => {
    document.cookie = 'token=; path=/; max-age=0'; // 쿠키 삭제
    router.push('/login'); // 로그인 페이지로 이동
  };

  return (
    <header
      style={{
        height: '60px',
        backgroundColor: 'white',
        borderBottom: '1px solid #ccc',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '0 1rem',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <button onClick={handleLogout} style={{ padding: '6px 12px', fontWeight: 'bold' }}>
        로그아웃
      </button>
    </header>
  );
}
