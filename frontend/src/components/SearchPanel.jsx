export default function SearchPanel({
  keyword,
  setKeyword,
  onSearch,
  places,
  selectedPlace,
  onSelectPlace,
  onSaveLocation,
  onSaveCandidate,
}) {
  return (
    <>
      <div className="search-box">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
          placeholder="장소를 검색하세요"
        />
        <button onClick={onSearch}>검색</button>
      </div>

      <section className="panel search-panel">
        <div className="panel-title">
          <div>
            <h2>검색 결과</h2>
            <span>{places.length}개의 장소</span>
          </div>
        </div>
        <div className="place-list">
          {places.length === 0 ? (
            <div className="empty-state">
              <span>📍</span>
              <p>장소를 검색해보세요.</p>
            </div>
          ) : (
            places.map((place) => {
              const isSelected = selectedPlace?.id === place.id;
              return (
                <button
                  className={`place-item ${isSelected ? "selected" : ""}`}
                  key={place.id}
                  onClick={() => onSelectPlace(place)}
                >
                  <strong>{place.place_name || place.placeName || "장소명 없음"}</strong>
                  <span>
                    {place.road_address_name ||
                      place.roadAddressName ||
                      place.address_name ||
                      place.addressName}
                  </span>
                  {place.phone && <span>{place.phone}</span>}
                </button>
              );
            })
          )}
        </div>
        {selectedPlace && (
          <div className="selected-place">
            <div>
              <span className="selected-label">선택한 장소</span>
              <strong>{selectedPlace.place_name || selectedPlace.placeName}</strong>
            </div>
            <div className="selected-place-actions">
              <button onClick={onSaveLocation}>+ 출발지 등록/변경</button>
              <button onClick={onSaveCandidate}>+ 후보 등록</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
