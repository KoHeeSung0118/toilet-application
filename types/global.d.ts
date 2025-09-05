// types/global.d.ts
export {};

declare global {
  interface Window {
    kakao: typeof kakao;
  }

  /** Kakao Maps (필요 최소 시그니처만) */
  namespace kakao {
    namespace maps {
      /** SDK 준비 콜백 */
      function load(callback: () => void): void;

      /** 좌표 */
      class LatLng {
        constructor(latitude: number, longitude: number);
        getLat(): number;
        getLng(): number;
      }

      /** 지도 옵션 & 지도 */
      interface MapOptions {
        center: LatLng;
        level?: number;
      }
      class Map {
        constructor(container: HTMLElement, options: MapOptions);
        setCenter(latlng: LatLng): void;
        panTo(latlng: LatLng): void;
        getCenter(): LatLng;
      }

      /** 크기/포인트 */
      class Size { constructor(width: number, height: number); }
      class Point { constructor(x: number, y: number); }

      /** 마커 이미지 */
      interface MarkerImageOptions { offset?: Point; }
      class MarkerImage {
        constructor(src: string, size: Size, options?: MarkerImageOptions);
      }

      /** 마커 */
      interface MarkerOptions {
        map?: Map;
        position: LatLng;
        zIndex?: number;
      }
      class Marker {
        constructor(options: MarkerOptions);
        setMap(map: Map | null): void;
        setPosition(pos: LatLng): void;
        setImage(img: MarkerImage): void;
      }

      /** 커스텀 오버레이 */
      interface CustomOverlayOptions {
        position: LatLng;
        content: HTMLElement | string;
        xAnchor?: number;
        yAnchor?: number;
        zIndex?: number;
        clickable?: boolean;
      }
      class CustomOverlay {
        constructor(options: CustomOverlayOptions);
        setMap(map: Map | null): void;
      }

      /** 이벤트 */
      namespace event {
        // Map/Marker 둘 다에 쓰는 최소 시그니처
        function addListener(
          target: Map | Marker | CustomOverlay,
          type: 'click' | 'dblclick' | 'idle',
          handler: () => void
        ): void;
      }

      /** 서비스 (지오코더/장소) */
      namespace services {
        type Status = 'OK' | 'ZERO_RESULT' | 'ERROR';

        interface GeocoderResult { x: string; y: string; }
        class Geocoder {
          addressSearch(
            keyword: string,
            callback: (result: GeocoderResult[], status: Status) => void
          ): void;
        }

        interface PlaceResult { id: string; place_name: string; x: string; y: string; }
        interface PlacesOptions { location?: LatLng; radius?: number; }
        class Places {
          keywordSearch(
            keyword: string,
            callback: (result: PlaceResult[], status: Status) => void,
            options?: PlacesOptions
          ): void;
        }
      }
    }
  }
}
