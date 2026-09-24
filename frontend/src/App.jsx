import { useEffect, useRef, useState } from "react";

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

let kakaoMapsPromise;

function loadKakaoMaps() {
  if (kakaoMapsPromise) return kakaoMapsPromise;

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
        reject(new Error("Kakao Maps SDK를 찾을 수 없습니다."));
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
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [roomId] = useState(1);
  const [userId] = useState(1);
  const [candidates, setCandidates] = useState([]);
  const [voteCounts, setVoteCounts] = useState({});
  const [votingPlaceId, setVotingPlaceId] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationMarkers, setLocationMarkers] = useState([]);
  const [routeTarget, setRouteTarget] = useState(null);
  const [transportMode, setTransportMode] = useState(null);

  const loadLocations = async () => {
    try {
      const response = await fetch("/api/locations/room/" + roomId);
      if (!response.ok) throw new Error("출발지 조회에 실패했습니다.");

      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error(error);
      alert("출발지를 불러오지 못했습니다.");
    }
  };

  const loadCandidates = async () => {
    try {
      const response = await fetch("/api/place-candidates/room/" + roomId);
      if (!response.ok) throw new Error("후보 장소 조회에 실패했습니다.");

      const data = await response.json();
      setCandidates(data);

      const countEntries = await Promise.all(
        data.map(async (candidate) => {
          const voteResponse = await fetch(
            "/api/votes/place/" + candidate.placeId
          );
          if (!voteResponse.ok) throw new Error("투표 수 조회에 실패했습니다.");

          const votes = await voteResponse.json();
          return [candidate.placeId, votes.length];
        })
      );

      setVoteCounts(Object.fromEntries(countEntries));
    } catch (error) {
      console.error(error);
      alert("후보 장소를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    loadCandidates();
    loadLocations();
  }, []);

  const searchPlaces = async () => {
    if (!keyword.trim()) return;

    try {
      const response = await fetch(
        "/api/kakao/places?query=" + encodeURIComponent(keyword)
      );

      if (!response.ok) throw new Error("장소 검색에 실패했습니다.");

      const data = await response.json();
      setPlaces(data.documents ?? []);
      setSelectedPlace(null);
      setWeather(null);
    } catch (error) {
      console.error(error);
      alert("장소 검색에 실패했습니다.");
    }
  };

  const loadWeather = async (place) => {
    setWeather(null);
    setWeatherLoading(true);

    try {
      const response = await fetch(
        "/api/weather?latitude=" +
          encodeURIComponent(place.y) +
          "&longitude=" +
          encodeURIComponent(place.x)
      );

      if (!response.ok) {
        throw new Error("날씨 조회에 실패했습니다.");
      }

      const data = await response.json();
      setWeather(data.current ?? null);
    } catch (error) {
      console.error(error);
    } finally {
      setWeatherLoading(false);
    }
  };

  const selectPlace = (place) => {
    setSelectedPlace(place);
    loadWeather(place);

    if (map) {
      map.setCenter(
        new window.kakao.maps.LatLng(Number(place.y), Number(place.x))
      );
    }
  };

  const getWeatherText = (code) => {
    if (code === 0) return "맑음";
    if ([1, 2, 3].includes(code)) return "구름 많음";
    if ([45, 48].includes(code)) return "안개";
    if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
    if ([61, 63, 65, 66, 67].includes(code)) return "비";
    if ([71, 73, 75, 77].includes(code)) return "눈";
    if ([80, 81, 82].includes(code)) return "소나기";
    if ([85, 86].includes(code)) return "눈 소나기";
    if ([95, 96, 99].includes(code)) return "뇌우";
    return "날씨 정보";
  };

  const saveLocation = async () => {
    if (!selectedPlace) {
      alert("먼저 장소를 선택하세요.");
      return;
    }

    const requestBody = {
      roomId,
      userId,
      address:
        selectedPlace.road_address_name ||
        selectedPlace.roadAddressName ||
        selectedPlace.address_name ||
        selectedPlace.addressName ||
        selectedPlace.place_name ||
        selectedPlace.placeName,
      latitude: Number(selectedPlace.y),
      longitude: Number(selectedPlace.x),
    };

    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "출발지 등록에 실패했습니다.");
      }

      alert("출발지가 등록/변경되었습니다!");
      await loadLocations();
    } catch (error) {
      console.error(error);
      alert("출발지 등록에 실패했습니다.");
    }
  };

  const saveCandidate = async () => {
    if (!selectedPlace) {
      alert("먼저 장소를 선택하세요.");
      return;
    }

    const requestBody = {
      roomId,
      placeName: selectedPlace.place_name || selectedPlace.placeName,
      address:
        selectedPlace.road_address_name ||
        selectedPlace.roadAddressName ||
        selectedPlace.address_name ||
        selectedPlace.addressName,
      latitude: Number(selectedPlace.y),
      longitude: Number(selectedPlace.x),
      kakaoPlaceId: selectedPlace.id,
    };

    try {
      const response = await fetch("/api/place-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error("후보 장소 등록에 실패했습니다.");

      const savedPlace = await response.json();
      alert(savedPlace.placeName + " 후보 등록 완료!");
      setSelectedPlace(null);
      await loadCandidates();
    } catch (error) {
      console.error(error);
      alert("후보 장소 등록에 실패했습니다.");
    }
  };

  const vote = async (placeId) => {
    setVotingPlaceId(placeId);

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, userId }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "투표에 실패했습니다.");
      }

      alert("투표가 완료되었습니다.");
      await loadCandidates();
    } catch (error) {
      console.error(error);
      alert(error.message || "투표에 실패했습니다.");
    } finally {
      setVotingPlaceId(null);
    }
  };

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

  useEffect(() => {
    if (!map || !window.kakao?.maps) return;

    locationMarkers.forEach((marker) => marker.setMap(null));

    const newLocationMarkers = locations.map((location) => {
      const position = new window.kakao.maps.LatLng(
        Number(location.latitude),
        Number(location.longitude)
      );

      const marker = new window.kakao.maps.Marker({ map, position });

      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div class="info-window">출발지<br/>${location.address}</div>`,
      });

      window.kakao.maps.event.addListener(marker, "click", () => {
        infowindow.open(map, marker);
      });

      return marker;
    });

    setLocationMarkers(newLocationMarkers);

    markers.forEach((marker) => marker.setMap(null));

    const newMarkers = places.map((place) => {
      const position = new window.kakao.maps.LatLng(
        Number(place.y),
        Number(place.x)
      );

      const marker = new window.kakao.maps.Marker({ map, position });

      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div class="info-window">${place.place_name || place.placeName}</div>`,
      });

      window.kakao.maps.event.addListener(marker, "click", () => {
        setSelectedPlace(place);
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
  }, [map, places, locations]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">LOCATION · VOTE · MEET</p>
          <h1>Meet-Up</h1>
          <p>함께 만날 장소를 검색하고 후보를 정해보세요.</p>
        </div>
      </header>

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

        <aside className="sidebar">
          <section className="panel search-panel">
            <div className="panel-title">
              <div>
                <h2>검색 결과</h2>
                <span>{places.length}개의 장소</span>
              </div>
            </div>

            <div className="place-list">
              {places.length === 0 ? (
                <div className="empty-state">
                  <span>📍</span>
                  <p>장소를 검색해보세요.</p>
                </div>
              ) : (
                places.map((place) => {
                  const isSelected = selectedPlace?.id === place.id;

                  return (
                    <button
                      className={`place-item ${isSelected ? "selected" : ""}`}
                      key={place.id}
                      onClick={() => selectPlace(place)}
                    >
                      <strong>
                        {place.place_name || place.placeName || "장소명 없음"}
                      </strong>
                      <span>
                        {place.road_address_name ||
                          place.roadAddressName ||
                          place.address_name ||
                          place.addressName}
                      </span>
                      {place.phone && <span>{place.phone}</span>}
                    </button>
                  );
                })
              )}
            </div>

            {selectedPlace && (
              <div className="selected-place">
                <div>
                  <span className="selected-label">선택한 장소</span>
                  <strong>
                    {selectedPlace.place_name || selectedPlace.placeName}
                  </strong>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={saveLocation}>+ 출발지 등록/변경</button>
                  <button onClick={saveCandidate}>+ 후보 등록</button>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>내 출발지</h2>
                <span>{locations.length}개 등록</span>
              </div>
            </div>

            {locations.length === 0 ? (
              <div className="empty-state">
                <span>🚩</span>
                <p>검색한 장소를 출발지로 등록하세요.</p>
              </div>
            ) : (
              <div className="candidate-list">
                {locations.map((location) => (
                  <div className="candidate-item" key={location.locationId}>
                    <div className="candidate-info">
                      <strong>출발지</strong>
                      <span>{location.address}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedPlace && (
            <section className="panel weather-panel">
              <div className="panel-title">
                <div>
                  <h2>현재 날씨</h2>
                  <span>선택한 장소 기준</span>
                </div>
              </div>

              <div className="weather-content">
                {weatherLoading ? (
                  <div className="weather-loading">날씨를 불러오는 중...</div>
                ) : weather ? (
                  <>
                    <div className="weather-main">
                      <strong>{weather.temperature_2m}°C</strong>
                      <span>{getWeatherText(weather.weather_code)}</span>
                    </div>
                    <div className="weather-details">
                      <span>습도 {weather.relative_humidity_2m}%</span>
                      <span>강수량 {weather.precipitation}mm</span>
                      <span>바람 {weather.wind_speed_10m}km/h</span>
                    </div>
                  </>
                ) : (
                  <div className="weather-loading">날씨 정보를 가져오지 못했습니다.</div>
                )}
              </div>
            </section>
          )}

          <section className="panel candidate-panel">
            <div className="panel-title">
              <div>
                <h2>모임 장소 후보</h2>
                <span>{candidates.length}개 후보</span>
              </div>
            </div>

            {candidates.length === 0 ? (
              <div className="empty-state">
                <span>🗳️</span>
                <p>검색한 장소를 후보로 등록하세요.</p>
              </div>
            ) : (
              <div className="candidate-list">
                {candidates.map((candidate) => (
                  <div className="candidate-item" key={candidate.placeId}>
                    <div className="candidate-info">
                      <strong>{candidate.placeName}</strong>
                      <span>{candidate.address}</span>
                      <b>현재 {voteCounts[candidate.placeId] ?? 0}표</b>
                      <button
                        onClick={() => {
                          setRouteTarget(candidate);
                          setTransportMode(null);
                        }}
                      >
                        🗺️ 길찾기
                      </button>
                    </div>

                    <button
                      onClick={() => vote(candidate.placeId)}
                      disabled={votingPlaceId === candidate.placeId}
                    >
                      {votingPlaceId === candidate.placeId
                        ? "..."
                        : "투표"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
        {routeTarget && (
          <div className="route-modal">
            <div className="route-modal-content">
              <h3>🗺️ 길찾기</h3>
              <p><strong>출발지</strong><br />{locations.find((location) => location.userId === userId)?.address || "내 출발지를 먼저 등록해주세요."}</p>
              <p><strong>목적지</strong><br />{routeTarget.placeName}</p>
              <div className="transport-buttons">
                <button className={transportMode === "transit" ? "selected" : ""} onClick={() => setTransportMode("transit")}>🚇 대중교통</button>
                <button className={transportMode === "car" ? "selected" : ""} onClick={() => setTransportMode("car")}>🚗 자동차</button>
                <button className={transportMode === "walk" ? "selected" : ""} onClick={() => setTransportMode("walk")}>🚶 도보</button>
              </div>
              {transportMode && (
                <p>선택한 이동수단: <strong>{transportMode === "transit" ? "대중교통" : transportMode === "car" ? "자동차" : "도보"}</strong><br />실제 길찾기 결과는 다음 단계에서 연결합니다.</p>
              )}
              <button onClick={() => setRouteTarget(null)}>닫기</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
