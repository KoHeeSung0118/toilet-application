'use client';

import React, { createContext, useContext, useState } from 'react';
type Toilet = any;

interface ToiletContextType {
  toiletList: Toilet[];
  setToiletList: (list: Toilet[]) => void;
  favorites: Toilet[];
  toggleFavorite: (toilet: Toilet) => void;
}

const ToiletContext = createContext<ToiletContextType | null>(null);

export function ToiletProvider({ children }: { children: React.ReactNode }) {
  const [toiletList, setToiletList] = useState<Toilet[]>([]);
  const [favorites, setFavorites] = useState<Toilet[]>([]);

  const toggleFavorite = (toilet: Toilet) => {
    setFavorites((prev) => {
      const exists = prev.find((t) => t.id === toilet.id);
      if (exists) {
        return prev.filter((t) => t.id !== toilet.id);
      } else {
        return [...prev, toilet];
      }
    });
  };

  return (
    <ToiletContext.Provider value={{ toiletList, setToiletList, favorites, toggleFavorite }}>
      {children}
    </ToiletContext.Provider>
  );
}

export function useToilet() {
  const context = useContext(ToiletContext);
  if (!context) throw new Error('useToilet은 ToiletProvider 안에서만 사용해야 합니다.');
  return context;
}
