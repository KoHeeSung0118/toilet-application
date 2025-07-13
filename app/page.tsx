// ✅ app/page.tsx  또는 app/(root)/page.tsx
"use client";                                  // ← 한 줄 추가

import MapView from "@/components/map/MapView";

export default function Mainpage() {
  return (
    <div className="bottombar">
      <MapView />
    </div>
  );
}
