'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// ✅ Toilet 타입 정의
export interface Toilet {
  id: string;
  place_name: string;
  overallRating?: number;
  reviews?: { user: string; comment: string }[];
  keywords?: string[]; // 👉 필요 시 추가
  lat: number;   // 위도
  lng: number;   // 경도
}

interface ToiletContextType {
  toiletList: Toilet[];
  setToiletList: (list: Toilet[]) => void;
}

const ToiletContext = createContext<ToiletContextType | null>(null);

// ✅ Provider 컴포넌트
export function ToiletProvider({ children }: { children: React.ReactNode }) {
  const [toiletList, setToiletList] = useState<Toilet[]>([]);

  // 💾 앱 시작 시 localStorage에서 복원
  useEffect(() => {
    const saved = localStorage.getItem('toiletList');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setToiletList(parsed);
        }
      } catch (e) {
        console.error('❌ localStorage에서 toiletList 복원 실패:', e);
      }
    }
  }, []);

  // 💾 toiletList가 바뀔 때 localStorage에 저장
  useEffect(() => {
    if (toiletList.length > 0) {
      localStorage.setItem('toiletList', JSON.stringify(toiletList));
    }
  }, [toiletList]);

  return (
    <ToiletContext.Provider value={{ toiletList, setToiletList }}>
      {children}
    </ToiletContext.Provider>
  );
}

// ✅ 커스텀 훅
export function useToilet() {
  const context = useContext(ToiletContext);
  if (!context) {
    throw new Error('useToilet은 ToiletProvider 안에서만 사용해야 합니다.');
  }
  return context;
}
