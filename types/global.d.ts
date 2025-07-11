export {};

declare global {
  interface Window {
    kakao: typeof kakao;
  }

  namespace kakao {
    namespace maps {
      function load(callback: () => void): void; // ✅ 요거 추가!!

      // 아래는 너가 이미 선언한 내용들
      class Map {
        constructor(container: HTMLElement, options: any);
        setCenter(latlng: LatLng): void;
        panTo(latlng: LatLng): void;
      }

      class LatLng {
        constructor(latitude: number, longitude: number);
      }

      class Marker {
        constructor(options: any);
        setMap(map: Map | null): void;
      }

      class MarkerImage {
        constructor(src: string, size: Size, options?: MarkerImageOptions);
      }

      interface MarkerImageOptions {
        offset?: Point;
      }

      class Size {
        constructor(width: number, height: number);
      }

      class Point {
        constructor(x: number, y: number);
      }

      class CustomOverlay {
        constructor(options: any);
        setMap(map: Map | null): void;
      }

      namespace services {
        class Geocoder {
          addressSearch(
            keyword: string,
            callback: (result: GeocoderResult[], status: Status) => void
          ): void;
        }

        interface GeocoderResult {
          x: string;
          y: string;
        }

        enum Status {
          OK = 'OK',
          ZERO_RESULT = 'ZERO_RESULT',
          ERROR = 'ERROR',
        }

        class Places {
          keywordSearch(
            keyword: string,
            callback: (result: any[], status: Status) => void,
            options?: { location: LatLng; radius: number }
          ): void;
        }
      }

      namespace event {
        function addListener(
          target: any,
          type: string,
          handler: (event: any) => void
        ): void;
      }
    }
  }
}
