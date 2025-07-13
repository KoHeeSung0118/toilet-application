// app/page.tsx
"use client";

import { Suspense } from "react";
import MapView from "@/components/map/MapView";   // ← MapView는 이미 "use client" 선언

export default function Mainpage() {
  return (
    <div className="bottombar">
      {/* CSR-bailout이 제대로 동작하도록 Suspense로 감쌉니다 */}
      <Suspense fallback={null}>
        <MapView />
      </Suspense>
    </div>
  );
}
