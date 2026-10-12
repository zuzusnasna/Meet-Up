export default function OriginPanel({
  locations,
  userId,
  onFocusMap,
  onFindMidpoint,
  midpoint,
  nearbyStationRadius,
  stationLoading,
  nearbyStations,
  onShowStation,
  onSetRouteTarget,
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>참여자 출발지</h2>
          <span>{locations.length}개 등록</span>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="empty-state">
          <span>🚩</span>
          <p>각 참여자가 등록한 출발지를 확인할 수 있습니다.</p>
        </div>
      ) : (
        <div className="candidate-list">
          {locations.map((location) => (
            <div
              className="candidate-item"
              key={location.locationId}
              onClick={() => onFocusMap(location.latitude, location.longitude)}
              style={{ cursor: "pointer" }}
            >
              <div className="candidate-info">
                <strong>
                  {location.userId === userId
                    ? "나의 출발지"
                    : `${location.userName || "참여자"}의 출발지`}
                </strong>
                <span>{location.address}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onFindMidpoint}
        disabled={locations.length < 2}
        className="midpoint-action"
      >
        <span className="midpoint-action-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </span>
        <span className="midpoint-action-copy">
          <strong>중간지점 찾기</strong>
          <span>{locations.length < 2 ? "출발지를 2곳 이상 등록해 주세요" : "모두의 출발지를 기준으로 위치 계산"}</span>
        </span>
        <span className="midpoint-action-arrow" aria-hidden="true">→</span>
      </button>

      {midpoint && (
        <button
          type="button"
          className="midpoint-result-card"
          onClick={() => onFocusMap(midpoint.latitude, midpoint.longitude)}
          aria-label="추천 중간 좌표를 지도에서 보기"
        >
          <span className="midpoint-result-icon" aria-hidden="true">⌖</span>
          <span className="midpoint-result-copy">
            <span className="midpoint-result-eyebrow">추천 중간 좌표</span>
            <strong>{midpoint.address}</strong>
            <span className="midpoint-result-hint">눌러서 지도에서 위치 확인 <span aria-hidden="true">↗</span></span>
          </span>
        </button>
      )}

      {midpoint && (
        <div className="station-section">
          <div className="panel-title">
            <div>
              <h2>🚇 주변 지하철역</h2>
              <span>
                {nearbyStationRadius
                  ? nearbyStationRadius / 1000 + "km 이내 검색 결과"
                  : "검색 중"}
              </span>
            </div>
          </div>
          {stationLoading ? (
            <div className="empty-state">
              <span>🚇</span>
              <p>주변 역을 찾는 중...</p>
            </div>
          ) : nearbyStations.length === 0 ? (
            <div className="empty-state">
              <span>🚉</span>
              <p>3km 이내에 검색되는 역이 없습니다.</p>
            </div>
          ) : (
            <div className="candidate-list">
              {nearbyStations.map((station) => (
                <div
                  className="candidate-item"
                  key={station.id}
                  onClick={() => onShowStation(station)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="candidate-info">
                    <strong>{station.place_name || station.placeName}</strong>
                    {station.distance && (
                      <b>
                        {Number(station.distance) >= 1000
                          ? (Number(station.distance) / 1000).toFixed(1) + "km"
                          : station.distance + "m"}
                      </b>
                    )}
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onShowStation(station);
                      onSetRouteTarget({
                        placeName: station.place_name || station.placeName || "지하철역",
                        latitude: Number(station.y),
                        longitude: Number(station.x),
                      });
                    }}
                  >
                    길찾기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
