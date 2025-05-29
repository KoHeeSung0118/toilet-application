'use client'; 

import { Home, Star, Menu } from 'lucide-react';
import './TabBar.css';
import Link from 'next/link';

export default function TabBar() {
  return (
    <div className="tab-bar">
      <Link href="/favorites" className="tab-item">
        <Star size={24}  />
      </Link>
      <Link href="/" className="tab-item">
        <Home size={24} />
      </Link>
      <Link href="/list" className="tab-item">
        <Menu size={24} />
      </Link>
    </div>
  );
}