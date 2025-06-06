'use client';

import React, { createContext, useContext, useState } from 'react';

// 타입 명확화: Toilet 구조 정의
export interface Toilet {
  id: string;
  place_name: string;
  overallRating?: number;
  reviews?: { user: string; comment: string }[];
  // 필요한 다른 필드들도 여기에 추가 가능
}

interface ToiletContextType {
  toiletList: Toilet[];
  setToiletList: (list: Toilet[]) => void;
}

const ToiletContext = createContext<ToiletContextType | null>(null);

// Provider 컴포넌트
export function ToiletProvider({ children }: { children: React.ReactNode }) {
  const [toiletList, setToiletList] = useState<Toilet[]>([]);

  return (
    <ToiletContext.Provider value={{ toiletList, setToiletList }}>
      {children}
    </ToiletContext.Provider>
  );
}

// 커스텀 훅
export function useToilet() {
  const context = useContext(ToiletContext);
  if (!context) {
    throw new Error('useToilet은 ToiletProvider 안에서만 사용해야 합니다.');
  }
  return context;
}
