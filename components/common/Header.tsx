'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { Search, LogOut } from 'lucide-react';
import './Header.css';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null); // ✅ input 참조

  const showSearch = pathname === '/' || pathname === '/list' || pathname === '/favorites';
  const hideLogout = pathname === '/login' || pathname === '/signup';

  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  const handleLogout = async () => {
    if (!confirm('정말로 로그아웃 하시겠습니까?')) return;

    const res = await fetch('/api/auth/logout', {
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

  // ✅ 버튼 클릭 시 검색창 열리고 자동 focus
  const handleSearchToggle = () => {
    setSearchOpen((prev) => {
      const next = !prev;
      if (!prev) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
      return next;
    });
  };

  return (
    <header className="header">
      {showSearch ? (
        <div className="search-area">
          <button
            onClick={handleSearchToggle}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="검색창 열기"
          >
            <Search size={20} />
          </button>

          <input
            ref={inputRef} // ✅ input 참조 연결
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="장소나 지역 검색"
            className={`search-input ${searchOpen ? 'open' : 'closed'}`}
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

      {!hideLogout && !searchOpen && (
        <button className="logout-button" onClick={handleLogout}>
          <LogOut size={16} />
        </button>
      )}
    </header>
  );
}
