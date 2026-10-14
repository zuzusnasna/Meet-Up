import { useEffect, useState } from "react";

export default function LastTrainPanel({ finalPlace, participants = [], locations = [] }) {
  const [routeResults, setRouteResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);
  const [pinnedSegment, setPinnedSegment] = useState(null);

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
          return [userId, data];
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

  const getBusNumbers = (segment) => {
    if (segment.type !== "BUS") return [];
    const values = (segment.vehicles || [])
      .map((vehicle) => {
        if (vehicle == null) return "";
        if (typeof vehicle === "string") return vehicle;
        return vehicle.name || vehicle.type || "";
      })
      .map((value) => String(value).trim())
      .filter(Boolean);
    return [...new Set(values)];
  };

  const getSegmentClass = (segment) => {
    if (segment.type === "WALKING") return "last-train-segment-walking";
    if (segment.type === "BUS") return "last-train-segment-bus";
    if (segment.type === "SUBWAY") return `last-train-segment-subway ${getSubwayLineClass(segment)}`;
    return "last-train-segment-etc";
  };

  const modeLabel = (type) => type === "SUBWAY" ? "지하철" : type === "BUS" ? "버스" : type === "WALKING" ? "도보" : type || "이동";

  return (
    <section className="last-train-page" onClick={() => setPinnedSegment(null)}>
      <div className="last-train-heading">
        <div><span className="last-train-eyebrow">RETURN TRIP</span><h2>막차 안내</h2><p>약속장소에서 참여자별 출발지로 돌아가는 대중교통 경로를 확인합니다.</p></div>
        <div className="last-train-destination"><span>최종 약속장소</span><strong>{finalPlace?.placeName || "미정"}</strong><small>{finalPlace?.address || ""}</small></div>
      </div>
      <div className="last-train-notice" role="note"><strong>조회 기준</strong><p>약속장소 → 출발지 방향의 경로를 빠른 순서로 최대 3개 표시합니다. 각 이동 구간에 마우스를 올리면 상세 경로가 표시되며, 클릭하면 고정됩니다.</p></div>
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
                      <div className="last-train-horizontal-route">
                        <div className="last-train-route-endpoint"><span className="last-train-route-dot" /><strong>{finalPlace?.placeName || "약속장소"}</strong></div>
                        <div className="last-train-horizontal-track">
                          {(route.segments || []).map((segment, segmentIndex) => {
                            const busNumbers = getBusNumbers(segment);
                            const segmentKey = `${participant.userId}-${routeIndex}-${segmentIndex}`;
                            const isPinned = pinnedSegment === segmentKey;
                            return <div
                              className={`last-train-horizontal-segment ${getSegmentClass(segment)}${isPinned ? " is-pinned" : ""}`}
                              key={segmentIndex}
                              tabIndex="0"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPinnedSegment(isPinned ? null : segmentKey);
                              }}
                            >
                              <div className="last-train-horizontal-line" />
                              <div className="last-train-horizontal-label"><span>{modeLabel(segment.type)}</span><strong>{formatDuration(segment.timeSeconds)}</strong></div>
                              {busNumbers.length > 0 && <div className="last-train-bus-numbers" aria-label="이용 가능한 버스 번호">{busNumbers.map((number, numberIndex) => <span key={`${number}-${numberIndex}`}>{number}</span>)}</div>}
                              <div className="last-train-horizontal-tooltip">
                                <strong>{modeLabel(segment.type)} · {formatDuration(segment.timeSeconds)}</strong>
                                {segment.guidance && <p>{segment.guidance}</p>}
                                {segment.stops?.length > 0 && <div className="last-train-horizontal-stops">{segment.stops.map((stop, stopIndex) => <span key={`${stop}-${stopIndex}`}>{stop}</span>)}</div>}
                              </div>
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
