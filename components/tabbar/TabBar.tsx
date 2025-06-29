'use client';

import { usePathname } from 'next/navigation';
import { Home, Star, Menu } from 'lucide-react';
import './TabBar.css';
import Link from 'next/link';

export default function TabBar() {
  const pathname = usePathname();

  const tabs = [
    { href: '/favorites', label: 'Favorites', icon: <Star size={20} /> },
    { href: '/', label: 'Map', icon: <Home size={20} /> },
    { href: '/list', label: 'List', icon: <Menu size={20} /> },
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
              <span className={`tab-label ${isActive ? 'active' : ''}`}>{tab.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
