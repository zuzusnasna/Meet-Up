import { useEffect, useState } from "react";

export default function LastTrainPanel({ finalPlace, participants = [], locations = [] }) {
  const [trainResults, setTrainResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLastTrainResults() {
      if (!finalPlace?.latitude || !finalPlace?.longitude) {
        setTrainResults({});
        return;
      }

      const targets = participants.map((participant) => {
        const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
        return { userId: participant.userId, location };
      }).filter((item) => item.location?.latitude != null && item.location?.longitude != null);

      setLoadingResults(true);
      const entries = await Promise.all(targets.map(async ({ userId, location }) => {
        const params = new URLSearchParams({
          originLatitude: String(location.latitude),
          originLongitude: String(location.longitude),
          destinationLatitude: String(finalPlace.latitude),
          destinationLongitude: String(finalPlace.longitude),
        });

        try {
          const response = await fetch("/api/transit/last-train?" + params.toString());
          if (!response.ok) throw new Error("막차 시간표 조회에 실패했습니다.");
          return [userId, await response.json()];
        } catch (error) {
          console.error(error);
          return [userId, { status: "ERROR", message: "시간표를 불러오지 못했습니다." }];
        }
      }));

      if (!cancelled) {
        setTrainResults(Object.fromEntries(entries));
        setLoadingResults(false);
      }
    }

    loadLastTrainResults();
    return () => { cancelled = true; };
  }, [finalPlace?.placeId, finalPlace?.latitude, finalPlace?.longitude, participants, locations]);

  const routeUrl = (location) => {
    if (!location || !finalPlace) return null;
    return "https://map.kakao.com/link/by/traffic/" +
      encodeURIComponent(location.address || "출발지") + "," + location.latitude + "," + location.longitude + "/" +
      encodeURIComponent(finalPlace.placeName || "최종 약속장소") + "," + finalPlace.latitude + "," + finalPlace.longitude;
  };

  const formatTrainStatus = (result) => {
    if (!result) return "시간표 조회 전";
    if (result.status === "OK" && result.lastDeparture?.departureTime) {
      return result.lastDeparture.departureTime;
    }
    if (result.status === "STATION_NOT_FOUND") return "주변 역을 찾지 못했습니다";
    if (result.status === "TAGO_STATION_NOT_FOUND") return "TAGO 역 정보 없음";
    if (result.status === "DIRECT_ROUTE_NOT_FOUND") return "직통 시간표 없음";
    if (result.status === "ERROR") return result.message || "조회 실패";
    return result.message || "막차 시각 확인 불가";
  };

  return (
    <section className="last-train-page">
      <div className="last-train-heading">
        <div><span className="last-train-eyebrow">RETURN TRIP</span><h2>막차 안내</h2>
          <p>최종 약속장소에서 참여자별 출발지로 돌아가는 대중교통 정보를 확인합니다.</p>
        </div>
        <div className="last-train-destination"><span>최종 약속장소</span><strong>{finalPlace?.placeName || "미정"}</strong><small>{finalPlace?.address || ""}</small></div>
      </div>
      <div className="last-train-notice" role="note">
        <strong>시간표 안내</strong>
        <p>지하철은 주변 역을 찾은 뒤 TAGO 시간표에서 직통 운행 후보를 조회합니다. 환승 경로의 실제 막차 시각은 확정할 수 없으며, 버스 막차 조회는 아직 연결되지 않았습니다. 확인할 수 없는 시간은 임의로 표시하지 않습니다.</p>
      </div>
      {loadingResults && <div className="last-train-loading">지하철 시간표를 조회하고 있습니다...</div>}
      {participants.length === 0 ? <div className="last-train-empty">참여자 정보를 불러오지 못했습니다.</div> : (
        <div className="last-train-list">
          {participants.map((participant) => {
            const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
            const result = trainResults[participant.userId];
            const url = routeUrl(location);
            return <article className="last-train-card" key={participant.userId}>
              <div className="last-train-person"><span className="last-train-avatar" aria-hidden="true">👤</span>
                <div><strong>{participant.name || participant.userName || participant.email || "참여자"}</strong><span>{location?.address || "출발지 미등록"}</span></div>
              </div>
              <div className="last-train-options">
                <div className="last-train-option"><span className="last-train-mode">🚇 지하철</span>
                  <strong>{location ? formatTrainStatus(result) : "출발지 미등록"}</strong>
                  {result?.originStation?.name && <small>출발지 주변역: {result.originStation.name}</small>}
                  {result?.destinationStation?.name && <small>약속장소 주변역: {result.destinationStation.name}</small>}
                  {result?.message && <small>{result.message}</small>}
                </div>
                <div className="last-train-option"><span className="last-train-mode">🚌 버스</span><strong>{location ? "막차 시각 조회 미연결" : "출발지 미등록"}</strong><small>버스 정류장 ID와 노선별 운행시간표 연동이 필요합니다.</small></div>
              </div>
              {url ? <a className="last-train-route-link" href={url} target="_blank" rel="noreferrer">대중교통 경로 확인 ↗</a> : <span className="last-train-route-disabled">출발지를 등록하면 경로를 확인할 수 있습니다.</span>}
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
