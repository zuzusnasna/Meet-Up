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

      <button onClick={onFindMidpoint} disabled={locations.length < 2} className="full-width-spaced-button">
        📍 중간지점 정하기
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
