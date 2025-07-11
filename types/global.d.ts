export {};

declare global {
  interface Window {
    kakao: any; // ✅ window.kakao만 선언
  }
}
