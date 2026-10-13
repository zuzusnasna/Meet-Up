import { useEffect, useState } from "react";

export default function LastTrainPanel({ finalPlace, participants = [], locations = [] }) {
  const [trainResults, setTrainResults] = useState({});
  const [busResults, setBusResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      if (!finalPlace?.latitude || !finalPlace?.longitude) {
        setTrainResults({});
        setBusResults({});
        return;
      }

      const targets = participants.map((participant) => {
        const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
        return { userId: participant.userId, location };
      }).filter((item) => item.location?.latitude != null && item.location?.longitude != null);

      setLoadingResults(true);
      const entries = await Promise.all(targets.map(async ({ userId, location }) => {
        const trainParams = new URLSearchParams({
          originLatitude: String(location.latitude), originLongitude: String(location.longitude),
          destinationLatitude: String(finalPlace.latitude), destinationLongitude: String(finalPlace.longitude),
        });
        const busParams = new URLSearchParams({
          latitude: String(finalPlace.latitude), longitude: String(finalPlace.longitude),
        });

        const [trainResponse, busResponse] = await Promise.all([
          fetch("/api/transit/last-train?" + trainParams.toString()),
          fetch("/api/transit/bus-arrivals?" + busParams.toString()),
        ]);

        let train = { status: "ERROR", message: "지하철 정보를 불러오지 못했습니다." };
        let bus = { status: "ERROR", message: "버스 정보를 불러오지 못했습니다." };
        try { if (trainResponse.ok) train = await trainResponse.json(); } catch (e) { console.error(e); }
        try { if (busResponse.ok) bus = await busResponse.json(); } catch (e) { console.error(e); }
        return [userId, { train, bus }];
      }));

      if (!cancelled) {
        setTrainResults(Object.fromEntries(entries.map(([id, value]) => [id, value.train])));
        setBusResults(Object.fromEntries(entries.map(([id, value]) => [id, value.bus])));
        setLoadingResults(false);
      }
    }

    loadResults().catch((error) => console.error(error));
    return () => { cancelled = true; };
  }, [finalPlace?.placeId, finalPlace?.latitude, finalPlace?.longitude, participants, locations]);

  const routeUrl = (location) => {
    if (!location || !finalPlace) return null;
    return "https://map.kakao.com/link/by/traffic/" + encodeURIComponent(location.address || "출발지") + "," + location.latitude + "," + location.longitude + "/" + encodeURIComponent(finalPlace.placeName || "최종 약속장소") + "," + finalPlace.latitude + "," + finalPlace.longitude;
  };

  const formatTrainStatus = (result) => {
    if (!result) return "시간표 조회 전";
    if (result.status === "OK" && result.lastDeparture?.departureTime) {
      const digits = String(result.lastDeparture.departureTime).replace(/[^0-9]/g, "");
      return digits.length >= 4 ? `${digits.slice(0, 2)}:${digits.slice(2, 4)}` : result.lastDeparture.departureTime;
    }
    if (result.status === "STATION_NOT_FOUND") return "주변 역을 찾지 못했습니다";
    if (result.status === "TAGO_STATION_NOT_FOUND") return "TAGO 역 정보 없음";
    if (result.status === "DIRECT_ROUTE_NOT_FOUND") return "직통 시간표 없음";
    return result.message || "막차 시각 확인 불가";
  };

  const formatBusStatus = (result) => {
    if (!result) return "조회 전";
    if (result.status !== "OK") return result.message || "버스 조회 실패";
    const arrivals = Array.isArray(result.arrivals) ? result.arrivals : [];
    if (!arrivals.length) return "현재 도착예정 버스 없음";
    const first = arrivals[0];
    const seconds = Number(first.arrtime);
    if (Number.isFinite(seconds)) return `${Math.max(0, Math.round(seconds / 60))}분 후 ${first.routeno || "버스"}`;
    return first.routeno || "도착정보 확인";
  };

  return (
    <section className="last-train-page">
      <div className="last-train-heading">
        <div><span className="last-train-eyebrow">RETURN TRIP</span><h2>막차 안내</h2><p>최종 약속장소에서 참여자별 출발지로 돌아가는 대중교통 정보를 확인합니다.</p></div>
        <div className="last-train-destination"><span>최종 약속장소</span><strong>{finalPlace?.placeName || "미정"}</strong><small>{finalPlace?.address || ""}</small></div>
      </div>
      <div className="last-train-notice" role="note">
        <strong>시간표 안내</strong>
        <p>지하철은 TAGO 시간표의 직통 운행 후보를 조회합니다. 버스는 약속장소 주변 정류장을 찾은 뒤 TAGO 실시간 도착정보를 조회합니다. 버스 도착정보 API는 운행시간표의 막차 시각을 제공하지 않으므로 임의의 막차 시간은 표시하지 않습니다.</p>
      </div>
      {loadingResults && <div className="last-train-loading">대중교통 정보를 조회하고 있습니다...</div>}
      {participants.length === 0 ? <div className="last-train-empty">참여자 정보를 불러오지 못했습니다.</div> : (
        <div className="last-train-list">
          {participants.map((participant) => {
            const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
            const train = trainResults[participant.userId];
            const bus = busResults[participant.userId];
            const url = routeUrl(location);
            return <article className="last-train-card" key={participant.userId}>
              <div className="last-train-person"><span className="last-train-avatar" aria-hidden="true">👤</span><div><strong>{participant.name || participant.userName || participant.email || "참여자"}</strong><span>{location?.address || "출발지 미등록"}</span></div></div>
              <div className="last-train-options">
                <div className="last-train-option"><span className="last-train-mode">🚇 지하철</span><strong>{location ? formatTrainStatus(train) : "출발지 미등록"}</strong>{train?.originStation?.name && <small>출발지 주변역: {train.originStation.name}</small>}{train?.destinationStation?.name && <small>약속장소 주변역: {train.destinationStation.name}</small>}{train?.message && <small>{train.message}</small>}</div>
                <div className="last-train-option"><span className="last-train-mode">🚌 버스</span><strong>{location ? formatBusStatus(bus) : "출발지 미등록"}</strong>{bus?.stationName && <small>약속장소 주변 정류장: {bus.stationName}</small>}{bus?.message && <small>{bus.message}</small>}</div>
              </div>
              {url ? <a className="last-train-route-link" href={url} target="_blank" rel="noreferrer">대중교통 경로 확인 ↗</a> : <span className="last-train-route-disabled">출발지를 등록하면 경로를 확인할 수 있습니다.</span>}
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
