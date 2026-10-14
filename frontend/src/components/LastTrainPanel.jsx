import { useEffect, useState } from "react";

export default function LastTrainPanel({ finalPlace, participants = [], locations = [] }) {
  const [routeResults, setRouteResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);

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

  const formatTime = (value) => {
    if (value == null || value === "") return "시간 확인 불가";
    const digits = String(value).replace(/[^0-9]/g, "");
    if (digits.length >= 4) return digits.slice(0, 2) + ":" + digits.slice(2, 4);
    return String(value);
  };

  const modeLabel = (type) => {
    if (type === "SUBWAY") return "지하철";
    if (type === "BUS") return "버스";
    if (type === "WALKING") return "도보";
    return type || "이동";
  };

  const formatDuration = (seconds) => {
    const minutes = Math.round(Number(seconds || 0) / 60);
    return minutes > 0 ? minutes + "분" : "시간 정보 없음";
  };

  const formatVehicles = (vehicles = []) => vehicles
    .map((vehicle) => {
      if (vehicle == null) return "";
      if (typeof vehicle === "string") return vehicle;
      const type = vehicle.type || "";
      const name = vehicle.name || "";
      return [type, name].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");

  const getSegmentVehicle = (segment) => formatVehicles(segment.vehicles || []);

  const getSubwayLineClass = (segment) => {
    const text = `${getSegmentVehicle(segment)} ${segment.guidance || ""} ${(segment.stops || []).join(" ")}`;
    const lineMatch = text.match(/([1-9]|[1-9]0)호선/);
    if (!lineMatch) return "last-train-line-default";
    return `last-train-line-${lineMatch[1]}`;
  };

  const getSegmentClass = (segment) => {
    if (segment.type === "WALKING") return "last-train-segment-walking";
    if (segment.type === "BUS") return "last-train-segment-bus";
    if (segment.type === "SUBWAY") return `last-train-segment-subway ${getSubwayLineClass(segment)}`;
    return "last-train-segment-etc";
  };

  return (
    <section className="last-train-page">
      <div className="last-train-heading">
        <div><span className="last-train-eyebrow">RETURN TRIP</span><h2>막차 안내</h2><p>약속장소에서 참여자별 출발지로 돌아가는 경로와 교통수단별 막차 정보를 확인합니다.</p></div>
        <div className="last-train-destination"><span>최종 약속장소</span><strong>{finalPlace?.placeName || "미정"}</strong><small>{finalPlace?.address || ""}</small></div>
      </div>
      <div className="last-train-notice" role="note">
        <strong>조회 기준</strong>
        <p>카카오 대중교통 길찾기에서 약속장소 → 출발지 방향의 경로와 환승 구간을 조회합니다.</p>
      </div>
      {loadingResults && <div className="last-train-loading">귀가 경로와 환승 구간을 조회하고 있습니다...</div>}
      {participants.length === 0 ? <div className="last-train-empty">참여자 정보를 불러오지 못했습니다.</div> : (
        <div className="last-train-list">
          {participants.map((participant) => {
            const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
            const result = routeResults[participant.userId];
            const routes = (Array.isArray(result?.routes) ? result.routes : [])
              .slice()
              .sort((a, b) => Number(a.totalTimeSeconds || 0) - Number(b.totalTimeSeconds || 0))
              .slice(0, 3);
            const url = routeUrl(location);
            return <article className="last-train-card" key={participant.userId}>
              <div className="last-train-person"><span className="last-train-avatar" aria-hidden="true">👤</span><div><strong>{participant.name || participant.userName || participant.email || "참여자"}</strong><span>{location?.address || "출발지 미등록"}</span></div></div>
              {!location ? <p>출발지를 등록하면 귀가 경로를 조회할 수 있습니다.</p> : (
                <>
                  {result?.message && <p className="last-train-route-message">{result.message}</p>}
                  {routes.length === 0 ? <div className="last-train-empty">대중교통 경로를 찾지 못했습니다.</div> : routes.map((route, routeIndex) => (
                    <div className="last-train-route-option" key={routeIndex}>
                      <div className="last-train-route-summary">
                        <strong>{route.type === "BUS" ? "🚌 버스" : route.type === "SUBWAY" ? "🚇 지하철" : "🚌🚇 버스·지하철 환승"}</strong>
                        <span>{formatDuration(route.totalTimeSeconds)} · 환승 {route.transferCount ?? 0}회</span>
                      </div>

                      <div className="last-train-route-line" aria-label="귀가 경로">
                        <div className="last-train-route-endpoint">
                          <span className="last-train-route-dot last-train-route-dot-start" />
                          <strong>{finalPlace?.placeName || "약속장소"}</strong>
                        </div>

                        <div className="last-train-route-track">
                          {(route.segments || []).map((segment, segmentIndex) => {
                            const train = segment.lastTrain;
                            const departure = train?.lastDeparture;
                            const vehicle = getSegmentVehicle(segment);
                            return <div className={`last-train-visual-segment ${getSegmentClass(segment)}`} key={segmentIndex}>
                              <div className="last-train-visual-line" />
                              <div className="last-train-visual-content">
                                <div className="last-train-visual-label">
                                  <span>{modeLabel(segment.type)}</span>
                                  <strong>{formatDuration(segment.timeSeconds)}</strong>
                                </div>
                                {vehicle && <div className="last-train-visual-vehicle">{vehicle}</div>}
                                {segment.stops?.length > 0 && <div className="last-train-visual-stops">
                                  {segment.stops.slice(0, 5).map((stop, stopIndex) => <span key={`${stop}-${stopIndex}`}>{stop}</span>)}
                                  {segment.stops.length > 5 && <span>외 {segment.stops.length - 5}개</span>}
                                </div>}
                              </div>
                              <div className="last-train-visual-node" />
                              {segment.type === "SUBWAY" && train?.message && <small className="last-train-visual-note">{train.status === "OK" && departure ? `막차 ${formatTime(departure.departureTime)}` : train.message}</small>}
                            </div>;
                          })}
                        </div>

                        <div className="last-train-route-endpoint">
                          <span className="last-train-route-dot last-train-route-dot-end" />
                          <strong>{location?.address || "출발지"}</strong>
                        </div>
                      </div>

                      <div className="last-train-segment-details">
                        {(route.segments || []).map((segment, segmentIndex) => {
                          const train = segment.lastTrain;
                          const departure = train?.lastDeparture;
                          return <div className="last-train-segment-detail" key={segmentIndex}>
                            <div className="last-train-segment-heading">
                              <strong>{modeLabel(segment.type)}</strong>
                              <span>{formatDuration(segment.timeSeconds)}</span>
                            </div>
                            {segment.guidance && <p>{segment.guidance}</p>}
                            {segment.type === "SUBWAY" && (
                              <p className="last-train-segment-last">지하철 막차: <strong>{train?.status === "OK" && departure ? formatTime(departure.departureTime) : "확인 불가"}</strong>{departure?.routeName && <span> · {departure.routeName}</span>}</p>
                            )}
                            {segment.type === "BUS" && <p className="last-train-segment-last">버스 막차: <strong>확인 불가</strong><small>{segment.lastBus?.message || "운행시간표 데이터가 연결되지 않았습니다."}</small></p>}
                          </div>;
                        })}
                      </div>
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
