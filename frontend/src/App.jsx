import { useEffect, useRef, useState } from "react";

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

let kakaoMapsPromise;

function loadKakaoMaps() {
  if (kakaoMapsPromise) {
    return kakaoMapsPromise;
  }

  kakaoMapsPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(resolve);
      return;
    }

    const script = document.createElement("script");

    script.src =
      "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" +
      encodeURIComponent(KAKAO_JS_KEY) +
      "&libraries=services&autoload=false";

    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error("Kakao Maps SDK가 로드되었지만 maps 객체를 찾을 수 없습니다."));
        return;
      }

      window.kakao.maps.load(resolve);
    };

    script.onerror = () => {
      reject(
        new Error(
          "Kakao Maps SDK 요청에 실패했습니다. JavaScript 키와 localhost 도메인 등록을 확인하세요."
        )
      );
    };

    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}

function App() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [keyword, setKeyword] = useState("스타벅스");
  const [places, setPlaces] = useState([]);
  const [markers, setMarkers] = useState([]);

  useEffect(() => {
    if (!KAKAO_JS_KEY) {
      console.error("VITE_KAKAO_JS_KEY가 설정되지 않았습니다.");
      return;
    }

    loadKakaoMaps()
      .then(() => {
        const kakaoMap = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(37.5665, 126.978),
          level: 5,
        });

        setMap(kakaoMap);
      })
      .catch((error) => {
        console.error("Kakao 지도 SDK 로딩 실패", error);
      });
  }, []);

  const searchPlaces = async () => {
    if (!keyword.trim()) return;

    try {
      const response = await fetch(
        "/api/kakao/places?query=" + encodeURIComponent(keyword)
      );

      if (!response.ok) {
        throw new Error("장소 검색에 실패했습니다.");
      }

      const data = await response.json();
      setPlaces(data.documents ?? []);
    } catch (error) {
      console.error(error);
      alert("장소 검색에 실패했습니다.");
    }
  };

  useEffect(() => {
    if (!map || !window.kakao?.maps) return;

    markers.forEach((marker) => marker.setMap(null));

    const newMarkers = places.map((place) => {
      const position = new window.kakao.maps.LatLng(
        Number(place.y),
        Number(place.x)
      );

      const marker = new window.kakao.maps.Marker({
        map,
        position,
      });

      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div class="info-window">${place.placeName}</div>`,
      });

      window.kakao.maps.event.addListener(marker, "click", () => {
        infowindow.open(map, marker);
      });

      return marker;
    });

    setMarkers(newMarkers);

    if (places.length > 0) {
      map.setCenter(
        new window.kakao.maps.LatLng(
          Number(places[0].y),
          Number(places[0].x)
        )
      );
    }
  }, [map, places]);

  return (
    <div className="app">
      <h1>Meet-Up</h1>

      <div className="search-box">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") searchPlaces();
          }}
          placeholder="장소를 검색하세요"
        />
        <button onClick={searchPlaces}>검색</button>
      </div>

      <div className="content">
        <div ref={mapRef} className="map" />

        <div className="place-list">
          <h2>검색 결과</h2>

          {places.map((place) => (
            <button
              className="place-item"
              key={place.id}
              onClick={() =>
                map?.setCenter(
                  new window.kakao.maps.LatLng(
                    Number(place.y),
                    Number(place.x)
                  )
                )
              }
            >
              <strong>{place.place_name || place.placeName || "장소명 없음"}</strong>
              <span>
                {place.road_address_name ||
                  place.roadAddressName ||
                  place.address_name ||
                  place.addressName}
              </span>
              {place.phone && <span>{place.phone}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
