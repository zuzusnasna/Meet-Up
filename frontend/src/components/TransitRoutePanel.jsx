import { useEffect, useState } from "react";
import "./transit-routes.css";

export default function TransitRoutePanel({ finalPlace, participants = [], locations = [] }) {
  const [routeResults, setRouteResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [pinnedSegment, setPinnedSegment] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRoutes() {
      if (finalPlace?.latitude == null || finalPlace?.longitude == null) {
        setRouteResults({});
        return;
      }

      const targets = participants.map((participant) => ({
        userId: participant.userId,
        location: locations.find((item) => Number(item.userId) === Number(participant.userId)),
      })).filter((item) => item.location?.latitude != null && item.location?.longitude != null);

      setLoading(true);
      const entries = await Promise.all(targets.map(async ({ userId, location }) => {
        const params = new URLSearchParams({
          meetingLatitude: String(finalPlace.latitude),
          meetingLongitude: String(finalPlace.longitude),
          originLatitude: String(location.latitude),
          originLongitude: String(location.longitude),
        });

        try {
          const response = await fetch("/api/transit/return-routes?" + params.toString());
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "귀가 경로 조회에 실패했습니다.");

          const routes = (Array.isArray(data.routes) ? data.routes : [])
            .filter((route) => Number(route.transferCount) > 0)
            .sort((a, b) => Number(a.totalTimeSeconds || 0) - Number(b.totalTimeSeconds || 0))
            .slice(0, 3);

          return [userId, {
            ...data,
            routes,
            message: routes.length
              ? "환승이 필요한 경로만 표시합니다."
              : "환승이 필요한 대중교통 경로를 찾지 못했습니다.",
          }];
        } catch (error) {
          console.error(error);
          return [userId, {
            status: "ERROR",
            message: error.message || "귀가 경로를 불러오지 못했습니다.",
            routes: [],
          }];
        }
      }));

      if (!cancelled) {
        setRouteResults(Object.fromEntries(entries));
        setLoading(false);
      }
    }

    loadRoutes().catch((error) => {
      console.error(error);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [finalPlace?.placeId, finalPlace?.latitude, finalPlace?.longitude, participants, locations]);

  const routeUrl = (location) => {
    if (!location || !finalPlace) return null;
    return "https://map.kakao.com/link/by/traffic/"
      + encodeURIComponent(finalPlace.placeName || "최종 약속장소") + ","
      + finalPlace.latitude + "," + finalPlace.longitude + "/"
      + encodeURIComponent(location.address || "출발지") + ","
      + location.latitude + "," + location.longitude;
  };

  const formatDuration = (seconds) => {
    const minutes = Math.round(Number(seconds || 0) / 60);
    return minutes > 0 ? minutes + "분" : "시간 정보 없음";
  };

  const formatVehicles = (vehicles = []) => vehicles
    .map((vehicle) => {
      if (vehicle == null) return "";
      if (typeof vehicle === "string") return vehicle;
      return [vehicle.type || "", vehicle.name || ""].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");

  const getSubwayLineClass = (segment) => {
    const text = `${formatVehicles(segment.vehicles || [])} ${segment.guidance || ""} ${(segment.stops || []).join(" ")}`;
    const match = text.match(/([1-9]|10)호선/);
    return match ? `transit-route-line-${match[1]}` : "";
  };

  const getBusInfo = (segment) => {
    if (segment.type !== "BUS") return [];
    return (segment.vehicles || [])
      .map((vehicle) => {
        if (vehicle == null) return null;
        const text = typeof vehicle === "string"
          ? vehicle
          : [vehicle.type || "", vehicle.name || ""].filter(Boolean).join(" ");
        const number = typeof vehicle === "string" ? vehicle : vehicle.name || vehicle.type || "";
        const normalized = text.replace(/\s+/g, " ").trim();
        let kind = "normal";
        if (/마을/.test(normalized)) kind = "village";
        else if (/시외/.test(normalized)) kind = "intercity";
        else if (/고속/.test(normalized)) kind = "express";
        else if (/광역|급행/.test(normalized)) kind = "metropolitan";
        else if (/지선/.test(normalized)) kind = "branch";
        else if (/간선/.test(normalized)) kind = "trunk";
        else if (/순환/.test(normalized)) kind = "circulation";
        return { number: String(number).trim(), kind };
      })
      .filter((item) => item?.number)
      .filter((item, index, array) => array.findIndex((candidate) => candidate.number === item.number) === index);
  };

  const getSegmentClass = (segment) => {
    if (segment.type === "WALKING") return "transit-route-segment-walking";
    if (segment.type === "BUS") return "transit-route-segment-bus";
    if (segment.type === "SUBWAY") return `transit-route-segment-subway ${getSubwayLineClass(segment)}`;
    return "transit-route-segment-other";
  };

  const modeLabel = (type) => type === "SUBWAY"
    ? "지하철"
    : type === "BUS" ? "버스" : type === "WALKING" ? "도보" : type || "이동";

  return (
    <section className="transit-routes-page" onClick={() => { setPinnedSegment(null); setHoveredSegment(null); }}>
      <header className="transit-routes-heading">
        <div>
          <span className="transit-routes-eyebrow">TRANSFER ROUTES</span>
          <h2>환승 경로</h2>
          <p>최종 약속장소에서 참여자 출발지까지, 환승이 필요한 대중교통 경로만 표시합니다.</p>
        </div>
        <div className="transit-routes-destination">
          <span>최종 약속장소</span>
          <strong>{finalPlace?.placeName || "미정"}</strong>
          <small>{finalPlace?.address || ""}</small>
        </div>
      </header>

      <div className="transit-routes-notice" role="note">
        <strong>조회 기준</strong>
        <p>약속장소에서 각 참여자의 출발지로 돌아가는 경로 중 환승 횟수가 1회 이상인 경로를 빠른 순서대로 최대 3개 표시합니다. 구간에 마우스를 올리면 상세 경로가 표시되고, 클릭하면 고정됩니다.</p>
      </div>

      {loading && <div className="transit-routes-loading">환승 경로를 조회하고 있습니다...</div>}
      {participants.length === 0 ? (
        <div className="transit-routes-empty">참여자 정보를 불러오지 못했습니다.</div>
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
                  <span className="transit-routes-avatar" aria-hidden="true">👤</span>
                  <div>
                    <strong>{participant.name || participant.userName || participant.email || "참여자"}</strong>
                    <span>{location?.address || "출발지 미등록"}</span>
                  </div>
                </div>

                {!location ? (
                  <p>출발지를 등록하면 환승 경로를 조회할 수 있습니다.</p>
                ) : (
                  <>
                    {result?.message && <p className="transit-routes-message">{result.message}</p>}
                    {routes.length === 0 ? (
                      <div className="transit-routes-empty">{result?.message || "환승 경로를 찾지 못했습니다."}</div>
                    ) : routes.map((route, routeIndex) => (
                      <div className="transit-routes-option" key={routeIndex}>
                        <div className="transit-routes-summary">
                          <strong>{routeIndex + 1}번 경로</strong>
                          <span>{formatDuration(route.totalTimeSeconds)} · 환승 {route.transferCount}회</span>
                        </div>

                        <div className="transit-routes-horizontal">
                          <div className="transit-routes-endpoint">
                            <span className="transit-routes-dot" />
                            <strong>{finalPlace?.placeName || "약속장소"}</strong>
                          </div>
                          <div className="transit-routes-track">
                            {(route.segments || []).map((segment, segmentIndex) => {
                              const busInfo = getBusInfo(segment);
                              const segmentKey = `${participant.userId}-${routeIndex}-${segmentIndex}`;
                              const isPinned = pinnedSegment === segmentKey;
                              const isActive = hoveredSegment === segmentKey || (hoveredSegment === null && isPinned);

                              return (
                                <div
                                  className={`transit-routes-segment ${getSegmentClass(segment)}${isPinned ? " is-pinned" : ""}`}
                                  key={segmentIndex}
                                  tabIndex="0"
                                  onMouseEnter={() => setHoveredSegment(segmentKey)}
                                  onMouseLeave={() => setHoveredSegment(null)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setPinnedSegment(isPinned ? null : segmentKey);
                                  }}
                                >
                                  <div className="transit-routes-line" />
                                  <div className="transit-routes-label">
                                    <span>{modeLabel(segment.type)}</span>
                                    <strong>{formatDuration(segment.timeSeconds)}</strong>
                                  </div>
                                  {busInfo.length > 0 && (
                                    <div className="transit-routes-bus-numbers" aria-label="이용 가능한 버스 번호">
                                      {busInfo.map((bus, index) => (
                                        <span className={`transit-routes-bus-${bus.kind}`} key={`${bus.number}-${index}`}>{bus.number}</span>
                                      ))}
                                    </div>
                                  )}
                                  {isActive && (
                                    <div className="transit-routes-tooltip">
                                      <strong>{modeLabel(segment.type)} · {formatDuration(segment.timeSeconds)}</strong>
                                      {segment.guidance && <p>{segment.guidance}</p>}
                                      {segment.stops?.length > 0 && (
                                        <div className="transit-routes-stops">
                                          {segment.stops.map((stop, index) => <span key={`${stop}-${index}`}>{stop}</span>)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="transit-routes-endpoint">
                            <span className="transit-routes-dot" />
                            <strong>{location?.address || "출발지"}</strong>
                          </div>
                        </div>

                        <div className="transit-routes-meta">
                          총 {formatDuration(route.totalTimeSeconds)} · {Math.round(Number(route.totalDistanceMeters || 0))}m
                          {url && <> · <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>카카오맵에서 보기 ↗</a></>}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
