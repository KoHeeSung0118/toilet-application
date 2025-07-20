'use client';

import { usePathname } from 'next/navigation';
import { Home, Star, Menu } from 'lucide-react';
import './TabBar.css';
import Link from 'next/link';

export default function TabBar() {
  const pathname = usePathname();

  // pathname이 null인 경우 또는 로그인/회원가입 페이지에서는 탭바 숨김
  if (!pathname) return null;
  const HIDE_ON = ['/login', '/signup'];
  if (HIDE_ON.includes(pathname)) {
    return null;
  }

  const tabs = [
    { href: '/favorites', label: 'Favorites', icon: <Star size={20} /> },
    { href: '/',           label: 'Map',       icon: <Home size={20} />   },
    { href: '/list',       label: 'List',      icon: <Menu size={20} />   },
  ];

  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab-item ${isActive ? 'active' : ''}`}
          >
            <div className="tab-icon-wrapper">
              <div className={`tab-icon-circle ${isActive ? 'active' : ''}`}>
                {tab.icon}
              </div>
              <span className={`tab-label ${isActive ? 'active' : ''}`}>
                {tab.label}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
