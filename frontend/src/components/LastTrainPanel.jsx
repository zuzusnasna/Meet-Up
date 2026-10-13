export default function LastTrainPanel({ finalPlace, participants = [], locations = [] }) {
  const routeUrl = (location) => {
    if (!location || !finalPlace) return null;
    return "https://map.kakao.com/link/by/traffic/" +
      encodeURIComponent(location.address || "출발지") + "," + location.latitude + "," + location.longitude + "/" +
      encodeURIComponent(finalPlace.placeName || "최종 약속장소") + "," + finalPlace.latitude + "," + finalPlace.longitude;
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
        <p>TAGO 지하철 API는 역별 시간표를, 버스 API는 현재 운행 중인 버스의 실시간 도착 정보를 제공합니다. 이 두 정보만으로 환승을 포함한 귀가 경로의 실제 막차 시각을 확정할 수는 없어 확인되지 않은 시간을 임의로 표시하지 않습니다. 경로를 열어 출발지별 대중교통 정보를 확인할 수 있습니다.</p>
      </div>
      {participants.length === 0 ? <div className="last-train-empty">참여자 정보를 불러오지 못했습니다.</div> : (
        <div className="last-train-list">
          {participants.map((participant) => {
            const location = locations.find((item) => Number(item.userId) === Number(participant.userId));
            const url = routeUrl(location);
            return <article className="last-train-card" key={participant.userId}>
              <div className="last-train-person"><span className="last-train-avatar" aria-hidden="true">👤</span>
                <div><strong>{participant.name || participant.userName || participant.email || "참여자"}</strong><span>{location?.address || "출발지 미등록"}</span></div>
              </div>
              <div className="last-train-options">
                <div className="last-train-option"><span className="last-train-mode">🚇 지하철</span><strong>{location ? "막차 시각 확인 필요" : "출발지 미등록"}</strong><small>환승 연결과 역별 운행 종료 시각을 확인하세요.</small></div>
                <div className="last-train-option"><span className="last-train-mode">🚌 버스</span><strong>{location ? "막차 시각 확인 필요" : "출발지 미등록"}</strong><small>실시간 도착정보와 노선별 막차 시각은 다를 수 있습니다.</small></div>
              </div>
              {url ? <a className="last-train-route-link" href={url} target="_blank" rel="noreferrer">대중교통 경로 확인 ↗</a> : <span className="last-train-route-disabled">출발지를 등록하면 경로를 확인할 수 있습니다.</span>}
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
