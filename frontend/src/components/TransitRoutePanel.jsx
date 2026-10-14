import { useEffect, useState } from "react";
import "../transit-routes.css";

export default function TransitRoutePanel({ finalPlace, participants = [], locations = [] }) {
  const [routeResults, setRouteResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [pinnedSegment, setPinnedSegment] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    setRouteResults({});
    setPinnedSegment(null);
    setHoveredSegment(null);
  }, [finalPlace?.placeId, finalPlace?.latitude, finalPlace?.longitude]);

  const refreshRoutes = async () => {
    if (finalPlace?.latitude == null || finalPlace?.longitude == null) return;

    const origins = participants.map((participant) => {
      const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
      return { participant, location };
    }).filter(({ location }) => location?.latitude != null && location?.longitude != null);

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
          refresh: true,
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
        const routes = (Array.isArray(raw.routes) ? raw.routes : [])
          .filter((route) => Number(route.transferCount) > 0)
          .sort((a, b) => Number(a.totalTimeSeconds || 0) - Number(b.totalTimeSeconds || 0))
          .slice(0, 3);
        normalized[participant.userId] = {
          ...raw,
          routes,
          message: routes.length
            ? "환승이 필요한 경로를 소요시간이 짧은 순으로 표시합니다."
            : "환승이 필요한 대중교통 경로를 찾지 못했습니다.",
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
    if (minutes <= 0) return "시간 정보 없음";
    if (minutes < 60) return `${minutes}분`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
  };

  const formatLastTrain = (lastTrainInfo) => {
    const value = lastTrainInfo?.lastDeparture?.departureTime;
    if (!value || !/^\d{6}$/.test(String(value))) return null;
    return `${String(value).slice(0, 2)}:${String(value).slice(2, 4)}`;
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
        const name = typeof vehicle === "string" ? vehicle : vehicle.name || "";
        const type = typeof vehicle === "string" ? "" : vehicle.type || "";
        const normalized = `${type} ${name}`.replace(/\s+/g, " ").trim();
        let kind = "normal";
        if (/마을|village/i.test(normalized)) kind = "village";
        else if (/시외|intercity/i.test(normalized)) kind = "intercity";
        else if (/고속|express/i.test(normalized)) kind = "express";
        else if (/광역|급행|metropolitan/i.test(normalized)) kind = "metropolitan";
        else if (/지선|branch/i.test(normalized)) kind = "branch";
        else if (/간선|trunk/i.test(normalized)) kind = "trunk";
        else if (/순환|circulation/i.test(normalized)) kind = "circulation";

        const numberMatch = name.match(/[0-9][0-9A-Za-z-]*/);
        const number = numberMatch ? numberMatch[0] : name || type;
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

  const modeLabel = (type) => type === "SUBWAY" ? "지하철" : type === "BUS" ? "버스" : type === "WALKING" ? "도보" : type || "이동";

  return (
    <section className="transit-routes-page" onClick={() => { setPinnedSegment(null); setHoveredSegment(null); }}>
      <header className="transit-routes-heading">
        <div>
          <span className="transit-routes-eyebrow">TRANSFER ROUTES</span>
          <h2>환승 경로</h2>
          <p>최종 약속장소에서 참여자 출발지까지, 환승이 필요한 대중교통 경로만 표시합니다.</p>
        </div>
        <div className="transit-routes-heading-actions">
          <button
            type="button"
            className="transit-routes-refresh"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              refreshRoutes();
            }}
            disabled={loading || finalPlace?.latitude == null || finalPlace?.longitude == null}
          >
            {loading ? "조회 중..." : "↻ 경로 새로고침"}
          </button>
          <div className="transit-routes-destination">
            <span>최종 약속장소</span>
            <strong>{finalPlace?.placeName || "미정"}</strong>
            <small>{finalPlace?.address || ""}</small>
          </div>
        </div>
      </header>

      <div className="transit-routes-notice" role="note">
        <strong>조회 기준</strong>
        <p>환승 경로는 자동으로 갱신하지 않습니다. 새로고침 버튼을 눌렀을 때 카카오에서 현재 가능한 경로를 다시 조회하고, 환승 경로 중 소요시간이 짧은 순으로 최대 3개를 표시합니다.</p>
      </div>

      {loading && <div className="transit-routes-loading">최신 환승 경로를 조회하고 있습니다...</div>}
      {participants.length === 0 ? (
        <div className="transit-routes-empty">참여자 정보를 불러오지 못했습니다.</div>
      ) : Object.keys(routeResults).length === 0 && !loading ? (
        <div className="transit-routes-empty">현재 가능한 환승 경로를 확인하려면 위의 새로고침 버튼을 눌러주세요.</div>
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
                    ) : routes.map((route, routeIndex) => {
                      return (
                        <div className="transit-routes-option" key={routeIndex}>
                          <div className="transit-routes-summary">
                            <strong>{routeIndex + 1}번 경로</strong>
                            <span>{formatDuration(route.totalTimeSeconds)} · 환승 {route.transferCount}회</span>
                          </div>
                          <div className="transit-routes-horizontal">
                            <div className="transit-routes-endpoint">
                              
                              <div>
                                <span className="transit-routes-endpoint-label">최종 목적지</span>
                                <strong>{finalPlace?.placeName || "약속장소"}</strong>
                              </div>
                            </div>
                            <div className="transit-routes-track">
                              {(route.segments || []).map((segment, segmentIndex, allSegments) => {
                                const busInfo = getBusInfo(segment);
                                const previousSegment = allSegments[segmentIndex - 1];
                                const isBusTransfer = segment.type === "BUS" && previousSegment?.type === "BUS";
                                const segmentKey = `${participant.userId}-${routeIndex}-${segmentIndex}`;
                                const isPinned = pinnedSegment === segmentKey;
                                const isActive = hoveredSegment === segmentKey || (hoveredSegment === null && isPinned);
                                return (
                                  <div className={`transit-routes-segment ${getSegmentClass(segment)}${isPinned ? " is-pinned" : ""}${isBusTransfer ? " is-bus-transfer" : ""}`} key={segmentIndex} tabIndex="0" onMouseEnter={() => setHoveredSegment(segmentKey)} onMouseLeave={() => setHoveredSegment(null)} onClick={(event) => { event.stopPropagation(); setPinnedSegment(isPinned ? null : segmentKey); }}>
                                    <div className="transit-routes-line" />
                                    <div className="transit-routes-label"><span>{modeLabel(segment.type)}</span><strong>{formatDuration(segment.timeSeconds)}</strong></div>
                                    {segment.type === "SUBWAY" && (
                                      <div className="transit-routes-segment-last-train">
                                        {formatLastTrain(segment.lastTrain)
                                          ? <>막차 <strong>{formatLastTrain(segment.lastTrain)}</strong></>
                                          : "막차 정보 없음"}
                                      </div>
                                    )}
                                    {busInfo.length > 0 && <div className="transit-routes-bus-numbers" aria-label="이용 가능한 버스 번호">{busInfo.map((bus, index) => <span className={`transit-routes-bus-${bus.kind}`} key={`${bus.number}-${index}`}>{bus.number}</span>)}</div>}
                                    {isBusTransfer && <span className="transit-routes-transfer-badge">버스 환승</span>}
                                    {isActive && <div className="transit-routes-tooltip"><strong>{modeLabel(segment.type)} · {formatDuration(segment.timeSeconds)}</strong>{segment.guidance && <p>{segment.guidance}</p>}{segment.stops?.length > 0 && <div className="transit-routes-stops">{segment.stops.map((stop, index) => <span key={`${stop}-${index}`}>{stop}</span>)}</div>}</div>}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="transit-routes-endpoint">
                              
                              <div>
                                <span className="transit-routes-endpoint-label">사용자 출발지</span>
                                <strong>{location?.address || "출발지"}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="transit-routes-meta">
                            총 {formatDuration(route.totalTimeSeconds)}
                            {url && <> · <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>카카오맵에서 보기 ↗</a></>}
                          </div>
                        </div>
                      );
                    })}
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
