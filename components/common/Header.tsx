'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { Search, LogOut } from 'lucide-react';
import './Header.css'; // ✅ CSS 파일 불러오기

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const showSearch = pathname === '/' || pathname === '/list' || pathname === '/favorites';
  const hideLogout = pathname === '/login' || pathname === '/signup';

  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  const handleLogout = async () => {
    if (!confirm('정말로 로그아웃 하시겠습니까?')) return;

    const res = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (res.ok) {
      router.push('/login');
    } else {
      alert('로그아웃 실패');
    }
  };

  const handleSearch = () => {
    if (!keyword.trim()) return;
    router.push(`/?query=${encodeURIComponent(keyword)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <header className="header">
      {showSearch ? (
        <div className="search-area">
          <button
            onClick={() => setSearchOpen((prev) => !prev)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Search size={20} />
          </button>

          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="장소나 지역 검색"
            className={`search-input ${searchOpen ? 'open' : ''}`}
          />

          {searchOpen && (
            <button className="search-button" onClick={handleSearch}>
              검색
            </button>
          )}
        </div>
      ) : (
        <div />
      )}

      {!hideLogout && (
        <button className="logout-button" onClick={handleLogout}>
          <LogOut size={16} />
        </button>
      )}
    </header>
  );
}
