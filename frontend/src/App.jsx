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
  const [roomId, setRoomId] = useState(() => {
    const savedRoomId = localStorage.getItem("meetupRoomId");
    return savedRoomId ? Number(savedRoomId) : null;
  });
  const [roomName, setRoomName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [voteCounts, setVoteCounts] = useState({});
  const [votingPlaceId, setVotingPlaceId] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationMarkers, setLocationMarkers] = useState([]);
  const [routeTarget, setRouteTarget] = useState(null);
  const [nearbyTarget, setNearbyTarget] = useState(null);
  const [nearbyCategory, setNearbyCategory] = useState("EVENT");
  const [nearbyItems, setNearbyItems] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [memos, setMemos] = useState([]);
  const [memoMarkers, setMemoMarkers] = useState([]);
  const [memoModal, setMemoModal] = useState(null);
  const [memoContent, setMemoContent] = useState("");
  const [memoType, setMemoType] = useState("GENERAL");

  const loadCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me");

      if (!response.ok) {
        setCurrentUser(null);
        return;
      }

      const user = await response.json();
      setCurrentUser(user);
    } catch (error) {
      console.error(error);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const userId = currentUser?.userId ?? null;

  const logout = () => {
    localStorage.removeItem("meetupRoomId");
    window.location.href = "/api/auth/logout/kakao";
  };

  const loadLocations = async () => {
    if (!roomId) return;

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
    if (!roomId) return;

    try {
      const response = await fetch("/api/place-candidates/room/" + roomId);
      if (!response.ok) throw new Error("후보 장소 조회에 실패했습니다.");

      const data = await response.json();
      setCandidates(data);

      const memoEntries = await Promise.all(
        data.map(async (candidate) => {
          const memoResponse = await fetch(
            "/api/memos/place/" + candidate.placeId
          );
          if (!memoResponse.ok) throw new Error("메모 조회에 실패했습니다.");
          return memoResponse.json();
        })
      );
      setMemos(memoEntries.flat());

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

  const createRoom = async () => {
    if (!userId) {
      alert("먼저 로그인해주세요.");
      return;
    }

    if (!roomName.trim()) {
      alert("모임 이름을 입력하세요.");
      return;
    }

    setRoomLoading(true);

    try {
      const response = await fetch(
        "/api/rooms?roomName=" +
          encodeURIComponent(roomName.trim()) +
          "&creatorId=" +
          userId,
        { method: "POST" }
      );

      if (!response.ok) throw new Error("모임방 생성에 실패했습니다.");

      const room = await response.json();
      localStorage.setItem("meetupRoomId", room.roomId);
      setRoomId(room.roomId);
      setCurrentRoom(room);
      setRoomName("");
    } catch (error) {
      console.error(error);
      alert(error.message || "모임방 생성에 실패했습니다.");
    } finally {
      setRoomLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!userId) {
      alert("먼저 로그인해주세요.");
      return;
    }

    const inputId = Number(roomInput);

    if (!inputId) {
      alert("모임방 ID를 입력하세요.");
      return;
    }

    setRoomLoading(true);

    try {
      const roomResponse = await fetch("/api/rooms/" + inputId);

      if (!roomResponse.ok) {
        throw new Error("존재하지 않는 모임방입니다.");
      }

      const room = await roomResponse.json();

      const participantResponse = await fetch(
        "/api/rooms/" + inputId + "/participants?userId=" + userId,
        { method: "POST" }
      );

      if (!participantResponse.ok) {
        throw new Error("모임방 입장에 실패했습니다.");
      }

      localStorage.setItem("meetupRoomId", room.roomId);
      setRoomId(room.roomId);
      setCurrentRoom(room);
      setRoomInput("");
    } catch (error) {
      console.error(error);
      alert(error.message || "모임방 입장에 실패했습니다.");
    } finally {
      setRoomLoading(false);
    }
  };

  const loadParticipants = async () => {
    if (!roomId) return;

    try {
      const response = await fetch(
        "/api/rooms/" + roomId + "/participants"
      );

      if (!response.ok) {
        throw new Error("참여자 조회에 실패했습니다.");
      }

      const data = await response.json();
      setParticipants(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadRoom = async () => {
    if (!roomId || !userId) return;

    try {
      const response = await fetch("/api/rooms/" + roomId);

      if (!response.ok) {
        localStorage.removeItem("meetupRoomId");
        setRoomId(null);
        return;
      }

      const room = await response.json();
      setCurrentRoom(room);

      await fetch(
        "/api/rooms/" + roomId + "/participants?userId=" + userId,
        { method: "POST" }
      );

      await loadParticipants();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!roomId || !userId) return;

    loadRoom();
    loadCandidates();
    loadLocations();
    loadParticipants();
  }, [roomId, userId]);

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

  const openKakaoRoute = (mode) => {
    const origin = locations.find((location) => location.userId === userId);

    if (!origin) {
      alert("먼저 내 출발지를 등록해주세요.");
      return;
    }

    if (!routeTarget) {
      return;
    }

    const originName = encodeURIComponent("내 출발지");
    const destinationName = encodeURIComponent(routeTarget.placeName);

    const url =
      "https://map.kakao.com/link/by/" +
      mode + "/" +
      originName + "," + origin.latitude + "," + origin.longitude +
      "/" +
      destinationName + "," + routeTarget.latitude + "," + routeTarget.longitude;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const loadNearby = async (target, category) => {
    setNearbyLoading(true);
    setNearbyItems([]);

    try {
      const response = await fetch(
        "/api/tourism?latitude=" +
          encodeURIComponent(target.latitude) +
          "&longitude=" +
          encodeURIComponent(target.longitude) +
          "&category=" +
          encodeURIComponent(category)
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "주변 정보 조회에 실패했습니다.");
      }

      const data = await response.json();
      setNearbyItems(data.items ?? []);
    } catch (error) {
      console.error(error);
      alert(error.message || "주변 정보를 불러오지 못했습니다.");
    } finally {
      setNearbyLoading(false);
    }
  };

  const openNearby = (candidate) => {
    setNearbyTarget(candidate);
    setNearbyCategory("EVENT");
    loadNearby(candidate, "EVENT");
  };

  const loadMemos = async () => {
    try {
      const memoEntries = await Promise.all(
        candidates.map(async (candidate) => {
          const response = await fetch(
            "/api/memos/place/" + candidate.placeId
          );

          if (!response.ok) {
            throw new Error("메모 조회에 실패했습니다.");
          }

          return response.json();
        })
      );

      setMemos(memoEntries.flat());
    } catch (error) {
      console.error(error);
      alert("메모를 불러오지 못했습니다.");
    }
  };

  const saveMemo = async () => {
    if (!memoModal || !memoContent.trim()) {
      alert("메모 내용을 입력하세요.");
      return;
    }

    try {
      const response = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: memoModal.placeId,
          userId,
          content: memoContent.trim(),
          memoType,
          latitude: memoModal.latitude,
          longitude: memoModal.longitude,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "메모 등록에 실패했습니다.");
      }

      setMemoModal(null);
      setMemoContent("");
      setMemoType("GENERAL");
      await loadMemos();
      await loadCandidates();
    } catch (error) {
      console.error(error);
      alert(error.message || "메모 등록에 실패했습니다.");
    }
  };

  const deleteMemo = async (memoId) => {
    if (!window.confirm("이 메모를 삭제할까요?")) return;

    try {
      const response = await fetch("/api/memos/" + memoId, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("메모 삭제에 실패했습니다.");
      await loadMemos();
    } catch (error) {
      console.error(error);
      alert(error.message || "메모 삭제에 실패했습니다.");
    }
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
    if (!roomId || !KAKAO_JS_KEY || !mapRef.current) {
      return;
    }

    loadKakaoMaps()
      .then(() => {
        if (!mapRef.current || map) {
          return;
        }

        const kakaoMap = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(37.5665, 126.978),
          level: 5,
        });

        setMap(kakaoMap);
      })
      .catch((error) => {
        console.error("Kakao 지도 SDK 로딩 실패", error);
      });
  }, [roomId, map]);

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
    memoMarkers.forEach((marker) => marker.setMap(null));

    const newMemoMarkers = memos.map((memo) => {
      const position = new window.kakao.maps.LatLng(
        Number(memo.latitude),
        Number(memo.longitude)
      );

      const marker = new window.kakao.maps.Marker({ map, position });

      const typeText = {
        GENERAL: "📌 일반",
        UMBRELLA: "☔ 우산",
        LATE_FEE: "⏰ 지각비",
        OTHER: "📍 기타",
      }[memo.memoType] || "📌 메모";

      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div class="info-window"><strong>${typeText}</strong><br/>${memo.content}</div>`,
      });

      window.kakao.maps.event.addListener(marker, "click", () => {
        infowindow.open(map, marker);
      });

      return marker;
    });

    setMemoMarkers(newMemoMarkers);

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
  }, [map, places, locations, memos]);

  if (authLoading) {
    return (
      <div className="room-entry">
        <div className="room-entry-card">
          <p>로그인 정보를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="room-entry">
        <div className="room-entry-card">
          <p className="eyebrow">LOCATION · VOTE · MEET</p>
          <h1>Meet-Up</h1>
          <p className="room-entry-description">
            소셜 계정으로 로그인하고 모임을 시작하세요.
          </p>

          <div className="social-login-buttons">
            <a href="/oauth2/authorization/kakao">🟡 카카오 로그인</a>
            <a href="/oauth2/authorization/naver">🟢 네이버 로그인</a>
            <a href="/oauth2/authorization/google">⚪ Google 로그인</a>
          </div>
        </div>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="room-entry">
        <div className="room-entry-card">
          <p className="eyebrow">LOCATION · VOTE · MEET</p>
          <h1>Meet-Up</h1>
          <p className="room-entry-description">
            모임방을 만들거나 기존 모임방에 입장하세요.
          </p>

          <div className="room-entry-section">
            <h2>새 모임 만들기</h2>
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createRoom();
              }}
              placeholder="예: 친구들과 서울 모임"
              maxLength={200}
            />
            <button onClick={createRoom} disabled={roomLoading}>
              {roomLoading ? "처리 중..." : "모임 만들기"}
            </button>
          </div>

          <div className="room-entry-divider">
            <span>또는</span>
          </div>

          <div className="room-entry-section">
            <h2>기존 모임방 입장</h2>
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") joinRoom();
              }}
              placeholder="모임방 ID를 입력하세요"
              inputMode="numeric"
            />
            <button onClick={joinRoom} disabled={roomLoading}>
              {roomLoading ? "처리 중..." : "입장하기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">LOCATION · VOTE · MEET</p>
          <h1>Meet-Up</h1>
          <p>{currentRoom?.roomName || "함께 만날 장소를 검색하고 후보를 정해보세요."}</p>
        </div>
        <div className="room-header-actions">
          <span>{currentUser.name || currentUser.email || "사용자"} · 방 ID: {roomId}</span>
          <button
            onClick={() => {
              localStorage.removeItem("meetupRoomId");
              setRoomId(null);
              setCurrentRoom(null);
            }}
          >
            방 나가기
          </button>
          <button onClick={logout}>
            로그아웃
          </button>
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

          <section className="panel participants-panel">
            <div className="panel-title">
              <div>
                <h2>👥 참여자</h2>
                <span>{participants.length}명 참여 중</span>
              </div>
            </div>

            {participants.length === 0 ? (
              <div className="empty-state">
                <span>👤</span>
                <p>아직 참여자가 없습니다.</p>
              </div>
            ) : (
              <div className="participant-list">
                {participants.map((participant) => (
                  <div
                    className="participant-item"
                    key={participant.roomId + "-" + participant.userId}
                  >
                    <span className="participant-avatar">👤</span>
                    <div>
                      <strong>
                        {participant.userId === userId
                          ? "나"
                          : participant.userName || "참여자 " + participant.userId}
                      </strong>
                      <span>{participant.email || "사용자 ID: " + participant.userId}</span>
                    </div>
                  </div>
                ))}
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
                      <div className="candidate-actions">
                        <button onClick={() => openNearby(candidate)}>
                          🌟 주변 정보
                        </button>
                        <button
                          onClick={() => {
                            setRouteTarget(candidate);
                          }}
                        >
                          🗺️ 길찾기
                        </button>
                        <button
                          onClick={() => {
                            setMemoModal({
                              placeId: candidate.placeId,
                              latitude: candidate.latitude,
                              longitude: candidate.longitude,
                              placeName: candidate.placeName,
                            });
                            setMemoContent("");
                            setMemoType("GENERAL");
                          }}
                        >
                          📍 메모
                        </button>
                      </div>
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
        {memoModal && (
          <div className="memo-modal">
            <div className="memo-modal-content">
              <h3>📍 메모 추가</h3>

              <label>
                내용
                <textarea
                  value={memoContent}
                  onChange={(event) => setMemoContent(event.target.value)}
                  placeholder="예: 우산 챙기기"
                  maxLength={500}
                  autoFocus
                />
              </label>

              <div className="memo-type">
                <span>종류</span>
                <div className="memo-type-buttons">
                  <button
                    className={memoType === "GENERAL" ? "active" : ""}
                    onClick={() => setMemoType("GENERAL")}
                  >
                    📌 일반
                  </button>
                  <button
                    className={memoType === "UMBRELLA" ? "active" : ""}
                    onClick={() => setMemoType("UMBRELLA")}
                  >
                    ☔ 우산
                  </button>
                  <button
                    className={memoType === "LATE_FEE" ? "active" : ""}
                    onClick={() => setMemoType("LATE_FEE")}
                  >
                    ⏰ 지각비
                  </button>
                  <button
                    className={memoType === "OTHER" ? "active" : ""}
                    onClick={() => setMemoType("OTHER")}
                  >
                    📍 기타
                  </button>
                </div>
              </div>

              <p className="memo-position">
                대상 장소: {memoModal.placeName}
              </p>

              <div className="memo-modal-actions">
                <button onClick={() => setMemoModal(null)}>취소</button>
                <button onClick={saveMemo}>등록</button>
              </div>
            </div>
          </div>
        )}

        {nearbyTarget && (
          <div className="nearby-modal">
            <div className="nearby-modal-content">
              <div className="nearby-header">
                <div>
                  <h3>🌟 주변 정보</h3>
                  <p>{nearbyTarget.placeName}</p>
                </div>
                <button
                  className="nearby-close"
                  onClick={() => setNearbyTarget(null)}
                >
                  ×
                </button>
              </div>

              <div className="nearby-tabs">
                <button
                  className={nearbyCategory === "EVENT" ? "active" : ""}
                  onClick={() => {
                    setNearbyCategory("EVENT");
                    loadNearby(nearbyTarget, "EVENT");
                  }}
                >
                  🎪 행사
                </button>
                <button
                  className={nearbyCategory === "TOURIST" ? "active" : ""}
                  onClick={() => {
                    setNearbyCategory("TOURIST");
                    loadNearby(nearbyTarget, "TOURIST");
                  }}
                >
                  🏛️ 관광지
                </button>
                <button
                  className={nearbyCategory === "RESTAURANT" ? "active" : ""}
                  onClick={() => {
                    setNearbyCategory("RESTAURANT");
                    loadNearby(nearbyTarget, "RESTAURANT");
                  }}
                >
                  🍽️ 맛집
                </button>
              </div>

              <div className="nearby-list">
                {nearbyLoading ? (
                  <div className="nearby-empty">주변 정보를 불러오는 중...</div>
                ) : nearbyItems.length === 0 ? (
                  <div className="nearby-empty">
                    주변 2km 안에 정보가 없습니다.
                  </div>
                ) : (
                  nearbyItems.map((item) => (
                    <div className="nearby-item" key={item.contentId}>
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="nearby-image"
                        />
                      )}

                      <div className="nearby-item-info">
                        <strong>{item.title}</strong>
                        {item.address && <span>{item.address}</span>}
                        {item.phone && <span>{item.phone}</span>}

                        {nearbyCategory === "EVENT" &&
                          (item.startDate || item.endDate) && (
                            <span className="nearby-date">
                              {item.startDate || ""} ~ {item.endDate || ""}
                            </span>
                          )}

                        {item.placeUrl && (
                          <a
                            href={item.placeUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            지도에서 보기 →
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {memos.length > 0 && (
          <div className="memo-list-floating">
            <strong>📍 지도 메모 {memos.length}개</strong>
            {memos.map((memo) => (
              <div className="memo-list-item" key={memo.memoId}>
                <span>{memo.content}</span>
                <button onClick={() => deleteMemo(memo.memoId)}>삭제</button>
              </div>
            ))}
          </div>
        )}

        {routeTarget && (
          <div className="route-modal">
            <div className="route-modal-content">
              <h3>🗺️ 길찾기</h3>
              <p><strong>출발지</strong><br />{locations.find((location) => location.userId === userId)?.address || "내 출발지를 먼저 등록해주세요."}</p>
              <p><strong>목적지</strong><br />{routeTarget.placeName}</p>
              <div className="transport-buttons">
                <button onClick={() => openKakaoRoute("traffic")}>🚇 대중교통</button>
                <button onClick={() => openKakaoRoute("car")}>🚗 자동차</button>
                <button onClick={() => openKakaoRoute("walk")}>🚶 도보</button>
              </div>
              <button onClick={() => setRouteTarget(null)}>닫기</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
