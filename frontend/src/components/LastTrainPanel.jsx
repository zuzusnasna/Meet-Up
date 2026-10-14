import { useEffect, useState } from "react";

export default function LastTrainPanel({ finalPlace, participants = [], locations = [] }) {
  const [routeResults, setRouteResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);
  const [pinnedSegment, setPinnedSegment] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadResults() {
      if (finalPlace?.latitude == null || finalPlace?.longitude == null) {
        setRouteResults({});
        return;
      }
      const targets = participants.map((participant) => ({
        userId: participant.userId,
        location: locations.find((item) => Number(item.userId) === Number(participant.userId)),
      })).filter((item) => item.location?.latitude != null && item.location?.longitude != null);
      setLoadingResults(true);
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

          // 각 카카오 귀가 경로별 지하철 구간을 보내 시간표와 환승 연결을 따로 검증한다.
          const routesWithSchedules = await Promise.all((Array.isArray(data.routes) ? data.routes : []).map(async (route) => {
            try {
              const routeSegments = Array.isArray(route.segments) ? route.segments : [];
              const nightBusIndex = routeSegments.findIndex(isNightBus);
              const validatedSegments = nightBusIndex >= 0
                ? routeSegments.slice(0, nightBusIndex)
                : routeSegments;
              const scheduleParams = new URLSearchParams({
                originLatitude: String(finalPlace.latitude),
                originLongitude: String(finalPlace.longitude),
                destinationLatitude: String(location.latitude),
                destinationLongitude: String(location.longitude),
                routeSegments: JSON.stringify(validatedSegments.map((segment) => ({
                  type: segment.type,
                  timeSeconds: segment.timeSeconds,
                  stops: segment.stops || [],
                  vehicles: segment.vehicles || [],
                  guidance: segment.guidance || "",
                }))),
              });
              const scheduleResponse = await fetch("/api/transit/last-train/route?" + scheduleParams.toString());
              const lastTrain = await scheduleResponse.json();
              return { ...route, lastTrain: scheduleResponse.ok ? lastTrain : null };
            } catch (scheduleError) {
              console.warn("귀가 경로별 막차 시간표 조회에 실패했습니다.", scheduleError);
              return { ...route, lastTrain: null };
            }
          }));
          return [userId, { ...data, routes: routesWithSchedules }];
        } catch (error) {
          console.error(error);
          return [userId, { status: "ERROR", message: error.message || "귀가 경로를 불러오지 못했습니다.", routes: [] }];
        }
      }));
      if (!cancelled) {
        setRouteResults(Object.fromEntries(entries));
        setLoadingResults(false);
      }
    }
    loadResults().catch((error) => {
      console.error(error);
      if (!cancelled) setLoadingResults(false);
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

  const parseDepartureMinutes = (value) => {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    if (digits.length < 4) return null;
    const hours = Number(digits.slice(0, 2));
    const minutes = Number(digits.slice(2, 4));
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const isNightBus = (segment) => {
    if (segment?.type !== "BUS") return false;
    const vehicleText = (segment.vehicles || []).map((vehicle) => {
      if (typeof vehicle === "string") return vehicle;
      return [vehicle?.name || "", vehicle?.type || ""].filter(Boolean).join(" ");
    }).join(" ");
    const text = `${vehicleText} ${segment.guidance || ""} ${(segment.stops || []).join(" ")}`;
    return /심야|(?:^|\s)N\s?\d{1,4}(?:\s|$)/i.test(text);
  };

  const getLastDepartureDeadline = (route, lastTrain) => {
    const segments = Array.isArray(route?.segments) ? route.segments : [];
    const departure = lastTrain?.lastDeparture?.departureTime;
    const departureMinutes = parseDepartureMinutes(departure);
    if (lastTrain?.status !== "OK" || departureMinutes == null || segments.length === 0) return null;

    // 심야버스는 막차 계산에서 제외하고, 그 직전의 지하철/일반 버스를 기준 구간으로 삼는다.
    const nightBusIndex = segments.findIndex(isNightBus);
    const limitIndex = nightBusIndex >= 0 ? nightBusIndex : segments.length;
    const reportedIndex = Number(lastTrain?.lastDeparture?.routeSegmentIndex);
    let targetIndex = Number.isInteger(reportedIndex) && reportedIndex >= 0
      ? reportedIndex
      : -1;
    if (targetIndex < 0) {
      for (let index = limitIndex - 1; index >= 0; index -= 1) {
        if (segments[index]?.type === "SUBWAY" || segments[index]?.type === "BUS") {
          targetIndex = index;
          break;
        }
      }
    }
    if (targetIndex < 0 || targetIndex >= limitIndex) return null;

    const precedingMinutes = segments.slice(0, targetIndex)
      .reduce((total, segment) => total + Math.max(0, Number(segment?.timeSeconds || 0)) / 60, 0);
    let deadline = Math.floor(departureMinutes - precedingMinutes - 10);
    deadline = ((deadline % 1440) + 1440) % 1440;
    const hours = String(Math.floor(deadline / 60)).padStart(2, "0");
    const minutes = String(deadline % 60).padStart(2, "0");
    return {
      time: `${hours}:${minutes}`,
      ignoredNightBus: nightBusIndex >= 0,
    };
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
    return match ? `last-train-line-${match[1]}` : "last-train-line-default";
  };

  const getBusInfo = (segment) => {
    if (segment.type !== "BUS") return [];
    return (segment.vehicles || [])
      .map((vehicle) => {
        if (vehicle == null) return null;
        const text = typeof vehicle === "string" ? vehicle : [vehicle.type || "", vehicle.name || ""].filter(Boolean).join(" ");
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
    if (segment.type === "WALKING") return "last-train-segment-walking";
    if (segment.type === "BUS") return "last-train-segment-bus";
    if (segment.type === "SUBWAY") return `last-train-segment-subway ${getSubwayLineClass(segment)}`;
    return "last-train-segment-etc";
  };

  const modeLabel = (type) => type === "SUBWAY" ? "지하철" : type === "BUS" ? "버스" : type === "WALKING" ? "도보" : type || "이동";

  return (
    <section className="last-train-page" onClick={() => { setPinnedSegment(null); setHoveredSegment(null); }}>
      <div className="last-train-heading">
        <div><span className="last-train-eyebrow">RETURN TRIP</span><h2>막차 안내</h2><p>약속장소에서 참여자별 출발지로 돌아가는 대중교통 경로를 확인합니다.</p></div>
        <div className="last-train-destination"><span>최종 약속장소</span><strong>{finalPlace?.placeName || "미정"}</strong><small>{finalPlace?.address || ""}</small></div>
      </div>
      <div className="last-train-notice" role="note"><strong>조회 기준</strong><p>약속장소 → 출발지 방향의 경로를 빠른 순서로 최대 3개 표시합니다. 막차 마감은 심야버스를 제외하고 참고 시간표에서 이전 구간 소요시간과 환승 여유 10분을 차감한 추정치입니다. 구간별 실제 막차 연결을 보장하지는 않습니다. 각 이동 구간에 마우스를 올리면 상세 경로가 표시되며, 클릭하면 고정됩니다.</p></div>
      {loadingResults && <div className="last-train-loading">귀가 경로와 환승 구간을 조회하고 있습니다...</div>}
      {participants.length === 0 ? <div className="last-train-empty">참여자 정보를 불러오지 못했습니다.</div> : (
        <div className="last-train-list">
          {participants.map((participant) => {
            const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
            const result = routeResults[participant.userId];
            const routes = (Array.isArray(result?.routes) ? result.routes : []).slice().sort((a, b) => Number(a.totalTimeSeconds || 0) - Number(b.totalTimeSeconds || 0)).slice(0, 3);
            const url = routeUrl(location);
            return <article className="last-train-card" key={participant.userId}>
              <div className="last-train-person"><span className="last-train-avatar" aria-hidden="true">👤</span><div><strong>{participant.name || participant.userName || participant.email || "참여자"}</strong><span>{location?.address || "출발지 미등록"}</span></div></div>
              {!location ? <p>출발지를 등록하면 귀가 경로를 조회할 수 있습니다.</p> : (
                <>
                  {result?.message && <p className="last-train-route-message">{result.message}</p>}
                  {routes.length === 0 ? <div className="last-train-empty">대중교통 경로를 찾지 못했습니다.</div> : routes.map((route, routeIndex) => (
                    <div className="last-train-route-option" key={routeIndex}>
                      <div className="last-train-route-summary"><strong>{routeIndex + 1}번 경로</strong><span>{formatDuration(route.totalTimeSeconds)} · 환승 {route.transferCount ?? 0}회</span></div>
                      {(() => {
                        const deadline = getLastDepartureDeadline(route, route.lastTrain);
                        if (deadline) {
                          return <div className="last-train-deadline"><strong>막차 출발 마감 추정 {deadline.time}</strong><span>{deadline.ignoredNightBus ? "심야버스 제외 · " : ""}환승 여유 10분 포함</span></div>;
                        }
                        const schedule = route.lastTrain;
                        const message = schedule?.message
                          || (schedule ? "막차 시간표에서 해당 방향의 직통 운행을 찾지 못했습니다." : "막차 시간표 API 응답을 받지 못했습니다.");
                        return <div className="last-train-deadline last-train-deadline-unavailable"><strong>막차 시간 확인 불가</strong><span>{message}</span></div>;
                      })()}
                      <div className="last-train-horizontal-route">
                        <div className="last-train-route-endpoint"><span className="last-train-route-dot" /><strong>{finalPlace?.placeName || "약속장소"}</strong></div>
                        <div className="last-train-horizontal-track">
                          {(route.segments || []).map((segment, segmentIndex) => {
                            const busInfo = getBusInfo(segment);
                            const segmentKey = `${participant.userId}-${routeIndex}-${segmentIndex}`;
                            const isPinned = pinnedSegment === segmentKey;
                            const isActive = hoveredSegment === segmentKey || (hoveredSegment === null && isPinned);
                            return <div
                              className={`last-train-horizontal-segment ${getSegmentClass(segment)}${isPinned ? " is-pinned" : ""}`}
                              key={segmentIndex}
                              tabIndex="0"
                              onMouseEnter={() => setHoveredSegment(segmentKey)}
                              onMouseLeave={() => setHoveredSegment(null)}
                              onClick={(event) => {
                                event.stopPropagation();
                                setPinnedSegment(isPinned ? null : segmentKey);
                              }}
                            >
                              <div className="last-train-horizontal-line" />
                              <div className="last-train-horizontal-label"><span>{modeLabel(segment.type)}</span><strong>{formatDuration(segment.timeSeconds)}</strong></div>
                              {busInfo.length > 0 && <div className="last-train-bus-numbers" aria-label="이용 가능한 버스 번호">{busInfo.map((bus, numberIndex) => <span className={`last-train-bus-number last-train-bus-number-${bus.kind}`} key={`${bus.number}-${numberIndex}`}>{bus.number}</span>)}</div>}
                              {isActive && <div className="last-train-horizontal-tooltip">
                                <strong>{modeLabel(segment.type)} · {formatDuration(segment.timeSeconds)}</strong>
                                {segment.guidance && <p>{segment.guidance}</p>}
                                {segment.stops?.length > 0 && <div className="last-train-horizontal-stops">{segment.stops.map((stop, stopIndex) => <span key={`${stop}-${stopIndex}`}>{stop}</span>)}</div>}
                              </div>}
                            </div>;
                          })}
                        </div>
                        <div className="last-train-route-endpoint"><span className="last-train-route-dot" /><strong>{location?.address || "출발지"}</strong></div>
                      </div>
                      <div className="last-train-route-meta">총 {formatDuration(route.totalTimeSeconds)} · 환승 {route.transferCount ?? 0}회</div>
                    </div>
                  ))}
                  {url && <a className="last-train-route-link" href={url} target="_blank" rel="noreferrer">카카오맵에서 귀가 경로 열기 ↗</a>}
                </>
              )}
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
