import { useEffect, useState } from "react";
import "../transit-routes.css";

export default function TransitRoutePanel({ finalPlace, participants = [], locations = [] }) {
  const [routeResults, setRouteResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [sortMode, setSortMode] = useState("time");
  const [pinnedSegment, setPinnedSegment] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    setRouteResults({});
    setPinnedSegment(null);
    setHoveredSegment(null);
  }, [finalPlace?.placeId, finalPlace?.latitude, finalPlace?.longitude]);

  const loadRoutes = async (mode = sortMode, refresh = false) => {
    if (finalPlace?.latitude == null || finalPlace?.longitude == null) return;
    const origins = participants
      .map((participant) => ({
        participant,
        location: locations.find((item) => Number(item.userId) === Number(participant.userId)),
      }))
      .filter(({ location }) => location?.latitude != null && location?.longitude != null);

    if (origins.length === 0) return;

    setLoading(true);
    setPinnedSegment(null);
    setHoveredSegment(null);

    try {
      const response = await fetch("/api/transit/return-routes/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingLatitude: Number(finalPlace.latitude),
          meetingLongitude: Number(finalPlace.longitude),
          refresh,
          mode,
          origins: origins.map(({ participant, location }) => ({
            userId: Number(participant.userId),
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "귀가 경로 조회에 실패했습니다.");

      const normalized = {};
      for (const { participant } of origins) {
        const raw = data[String(participant.userId)] || {};
        normalized[participant.userId] = {
          ...raw,
          routes: Array.isArray(raw.routes) ? raw.routes : [],
        };
      }
      setRouteResults(normalized);
    } catch (error) {
      console.error(error);
      setRouteResults({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!finalPlace || participants.length === 0 || locations.length === 0) return;
    loadRoutes(sortMode, false);
  }, [sortMode, finalPlace?.placeId, finalPlace?.latitude, finalPlace?.longitude, participants.length, locations.length]);

  const routeUrl = (location) => !location || !finalPlace
    ? null
    : "https://map.kakao.com/link/by/traffic/"
      + encodeURIComponent(finalPlace.placeName || "최종 약속장소") + "," + finalPlace.latitude + "," + finalPlace.longitude + "/"
      + encodeURIComponent(location.address || "출발지") + "," + location.latitude + "," + location.longitude;

  const formatDuration = (seconds) => {
    const minutes = Math.round(Number(seconds || 0) / 60);
    if (minutes <= 0) return "시간 정보 없음";
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
  };

  const formatLastTrain = (info) => {
    const value = info?.lastDeparture?.departureTime;
    return value && /^\d{6}$/.test(String(value))
      ? `${String(value).slice(0, 2)}:${String(value).slice(2, 4)}`
      : null;
  };

  const normalizeGuidance = (value) => {
    let text = String(value || "").replace(/\s+/g, " ").trim();
    // 지도 안내에 장소명이 연속으로 붙는 케이스(예: 종로2가종로2가정류장)를 정리한다.
    text = text.replace(/([가-힣0-9]+)\1(?=(?:정류장|역|까지))/g, "$1");
    text = text.replace(/([가-힣0-9]+)\1(?=정류장)/g, "$1");
    return text.replace(/\s+/g, " ").trim();
  };

  const normalizeStationName = (value) => String(value || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .replace(/(?:역|정류장)?(?:[1-9]|10)호선$/i, "")
    .replace(/역$/, "")
    .replace(/정류장$/, "")
    .trim()
    .toLowerCase();

  const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const r = (d) => d * Math.PI / 180;
    const dLat = r(lat2 - lat1);
    const dLon = r(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getDisplaySegments = (route) => {
    const segments = Array.isArray(route.segments) ? [...route.segments] : [];
    const firstTransitIndex = segments.findIndex((segment) => ["SUBWAY", "BUS"].includes(String(segment.type).toUpperCase()));
    if (firstTransitIndex < 0 || segments.slice(0, firstTransitIndex).some((segment) => ["WALKING", "WALK", "FOOT"].includes(String(segment.type).toUpperCase()))) return segments;

    const firstTransit = segments[firstTransitIndex];
    const firstStop = firstTransit.stops?.[0] || "";
    const destinationStation = finalPlace?.placeName || "";
    if (!firstStop || normalizeStationName(destinationStation) === normalizeStationName(firstStop)) return segments;

    const firstCoordinate = firstTransit.path?.[0];
    if (!Array.isArray(firstCoordinate) || firstCoordinate.length < 2 || finalPlace?.latitude == null || finalPlace?.longitude == null) return segments;

    const distance = haversineMeters(
      Number(finalPlace.latitude), Number(finalPlace.longitude),
      Number(firstCoordinate[1]), Number(firstCoordinate[0]),
    );
    if (!Number.isFinite(distance) || distance < 100) return segments;

    const walkingMinutes = Math.max(1, Math.round((distance * 1.25) / 75));
    segments.splice(firstTransitIndex, 0, {
      type: "WALKING",
      timeSeconds: walkingMinutes * 60,
      guidance: `${destinationStation || "최종 목적지"}에서 ${firstStop}까지 도보 이동`,
      stops: [],
      estimated: true,
    });
    return segments;
  };

  const formatVehicles = (vehicles = []) => vehicles
    .map((vehicle) => typeof vehicle === "string" ? vehicle : [vehicle?.type || "", vehicle?.name || ""].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");

  const getSubwayLineClass = (segment) => {
    const match = `${formatVehicles(segment.vehicles || [])} ${segment.guidance || ""} ${(segment.stops || []).join(" ")}`.match(/([1-9]|10)호선/);
    return match ? `transit-route-line-${match[1]}` : "";
  };

  const getBusInfo = (segment) => {
    if (segment.type !== "BUS") return [];
    return (segment.vehicles || [])
      .map((vehicle) => {
        const name = typeof vehicle === "string" ? vehicle : vehicle?.name || "";
        const type = typeof vehicle === "string" ? "" : vehicle?.type || "";
        const text = `${type} ${name}`.replace(/\s+/g, " ").trim();
        let kind = "normal";
        if (/마을|village/i.test(text)) kind = "village";
        else if (/시외|intercity/i.test(text)) kind = "intercity";
        else if (/고속|express/i.test(text)) kind = "express";
        else if (/광역|급행|metropolitan/i.test(text)) kind = "metropolitan";
        else if (/지선|branch/i.test(text)) kind = "branch";
        else if (/간선|trunk/i.test(text)) kind = "trunk";
        else if (/순환|circulation/i.test(text)) kind = "circulation";
        const numberMatch = name.match(/[0-9][0-9A-Za-z-]*/);
        return { number: String(numberMatch ? numberMatch[0] : name || type).trim(), kind };
      })
      .filter((item) => item.number)
      .filter((item, index, array) => array.findIndex((candidate) => candidate.number === item.number) === index);
  };

  const getSegmentClass = (segment) => ["WALKING", "WALK", "FOOT"].includes(String(segment.type).toUpperCase())
    ? "transit-route-segment-walking"
    : segment.type === "BUS"
      ? "transit-route-segment-bus"
      : segment.type === "SUBWAY"
        ? `transit-route-segment-subway ${getSubwayLineClass(segment)}`
        : "transit-route-segment-other";

  const modeLabel = (type) => ["WALKING", "WALK", "FOOT"].includes(String(type || "").toUpperCase())
    ? "도보"
    : type === "SUBWAY" ? "지하철" : type === "BUS" ? "버스" : type || "이동";

  return (
    <section className="transit-routes-page" onClick={() => { setPinnedSegment(null); setHoveredSegment(null); }}>
      <header className="transit-routes-heading">
        <div className="transit-routes-heading-copy">
          <h2>귀가 경로</h2>
          <p>참여자별 대중교통 경로와 막차 정보를 확인하세요.</p>
        </div>
        <div className="transit-routes-heading-actions">
          <button
            type="button"
            className="transit-routes-refresh"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); loadRoutes(sortMode, true); }}
            disabled={loading || finalPlace?.latitude == null || finalPlace?.longitude == null}
          >
            {loading ? "경로 확인 중…" : "새로고침"}
          </button>
          <div className="transit-routes-destination">
            <span>도착 장소</span>
            <strong>{finalPlace?.placeName || "미정"}</strong>
            <small>{finalPlace?.address || ""}</small>
          </div>
        </div>
      </header>

      <div className="transit-routes-toolbar">
        <span className="transit-routes-filter-label">경로 기준</span>
        <div className="transit-routes-sort" role="tablist" aria-label="귀가 경로 조회 기준">
          <button type="button" className={sortMode === "time" ? "is-active" : ""} onClick={() => setSortMode("time")} disabled={loading}>최단 시간</button>
          <button type="button" className={sortMode === "transfers" ? "is-active" : ""} onClick={() => setSortMode("transfers")} disabled={loading}>최소 환승</button>
        </div>
      </div>

      {loading && <div className="transit-routes-loading">최신 귀가 경로를 조회하고 있습니다…</div>}

      {participants.length === 0 ? (
        <div className="transit-routes-empty">참여자 정보를 불러오지 못했습니다.</div>
      ) : Object.keys(routeResults).length === 0 && !loading ? (
        <div className="transit-routes-empty">현재 가능한 귀가 경로가 없습니다.</div>
      ) : (
        <div className="transit-routes-list">
          {participants.map((participant) => {
            const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
            const result = routeResults[participant.userId];
            const routes = Array.isArray(result?.routes) ? result.routes : [];
            const url = routeUrl(location);

            return (
              <article className="transit-routes-card" key={participant.userId}>
                <div className="transit-routes-person">
                  <div>
                    <strong>{participant.name || participant.userName || participant.email || "참여자"}</strong>
                    <span>{location?.address || "출발지 미등록"}</span>
                  </div>
                </div>

                {!location ? (
                  <p className="transit-routes-message">출발지를 등록하면 귀가 경로를 조회할 수 있습니다.</p>
                ) : routes.length === 0 ? (
                  <div className="transit-routes-empty">환승이 필요한 귀가 경로를 찾지 못했습니다.</div>
                ) : routes.map((route, routeIndex) => (
                  <section className="transit-routes-option" key={routeIndex}>
                    <div className="transit-routes-summary">
                      <div className="transit-routes-route-title">
                        <span className="transit-routes-route-number">{String(routeIndex + 1).padStart(2, "0")}</span>
                        <strong>{formatDuration(route.totalTimeSeconds)}</strong>
                      </div>
                      <span>환승 {route.transferCount}회</span>
                    </div>

                    <div className="transit-routes-itinerary">
                      <div className="transit-routes-itinerary-stop is-start">
                        <span className="transit-routes-stop-mark" />
                        <div><small>출발</small><strong>{location?.address || "내 출발지"}</strong></div>
                      </div>
                      <div className="transit-routes-itinerary-legs">
                        {getDisplaySegments(route).map((segment, segmentIndex, allSegments) => {
                          const busInfo = getBusInfo(segment);
                          const previousSegment = allSegments[segmentIndex - 1];
                          const isBusTransfer = segment.type === "BUS" && previousSegment?.type === "BUS";
                          const segmentKey = `${participant.userId}-${routeIndex}-${segmentIndex}`;
                          const isPinned = pinnedSegment === segmentKey;
                          const isActive = hoveredSegment === segmentKey || (hoveredSegment === null && isPinned);
                          return (
                            <div
                              className={`transit-routes-segment ${getSegmentClass(segment)}${isPinned ? " is-pinned" : ""}${isBusTransfer ? " is-bus-transfer" : ""}`}
                              key={segmentIndex}
                              tabIndex="0"
                              onMouseEnter={() => setHoveredSegment(segmentKey)}
                              onMouseLeave={() => setHoveredSegment(null)}
                              onClick={(event) => { event.stopPropagation(); setPinnedSegment(isPinned ? null : segmentKey); }}
                            >
                              <span className="transit-routes-leg-mark" />
                              <div className="transit-routes-leg-content">
                                <div className="transit-routes-label"><strong>{modeLabel(segment.type)}</strong><span>{formatDuration(segment.timeSeconds)}</span></div>
                                {["WALKING", "WALK", "FOOT"].includes(String(segment.type).toUpperCase()) && segment.guidance && <p className="transit-routes-walking-guidance">{normalizeGuidance(segment.guidance)}</p>}
                                {segment.type === "SUBWAY" && <p className="transit-routes-segment-last-train">{formatLastTrain(route.lastTrain) ? <>막차 <strong>{formatLastTrain(route.lastTrain)}</strong></> : (route.lastTrain?.message || "막차 정보 없음")}</p>}
                                {busInfo.length > 0 && <div className="transit-routes-bus-numbers" aria-label="이용 가능한 버스 번호">{busInfo.map((bus, index) => <span className={`transit-routes-bus-${bus.kind}`} key={`${bus.number}-${index}`}>{bus.number}</span>)}</div>}
                                {isBusTransfer && <span className="transit-routes-transfer-badge">버스 환승</span>}
                                {isActive && <div className="transit-routes-tooltip"><strong>{modeLabel(segment.type)} · {formatDuration(segment.timeSeconds)}</strong>{segment.guidance && <p>{normalizeGuidance(segment.guidance)}</p>}{segment.stops?.length > 0 && <div className="transit-routes-stops">{segment.stops.map((stop, index) => <span key={`${stop}-${index}`}>{normalizeGuidance(stop)}</span>)}</div>}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="transit-routes-itinerary-stop is-end">
                        <span className="transit-routes-stop-mark" />
                        <div><small>도착</small><strong>{finalPlace?.placeName || "약속장소"}</strong></div>
                      </div>
                    </div>

                    <div className="transit-routes-meta">
                      <span>총 소요 시간 {formatDuration(route.totalTimeSeconds)}</span>
                      {url && <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>카카오맵에서 보기 <span aria-hidden="true">↗</span></a>}
                    </div>
                  </section>
                ))}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );

}
