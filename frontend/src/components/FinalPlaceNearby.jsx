import { useEffect, useState } from "react";

const CATEGORIES = {
  RESTAURANT: { label: "맛집", markerLabel: "맛", color: "#b95e35" },
  TOURIST: { label: "관광지", markerLabel: "관", color: "#356b4a" },
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function makeMarkerImage(category) {
  const config = CATEGORIES[category];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">' +
    '<path d="M18 1.5C8.9 1.5 2 8.4 2 17.1c0 11 16 25 16 25s16-14 16-25C34 8.4 27.1 1.5 18 1.5Z" fill="' + config.color + '" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="18" cy="17" r="10.5" fill="#fff"/>' +
    '<text x="18" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="' + config.color + '">' + config.markerLabel + '</text>' +
    "</svg>";
  return new window.kakao.maps.MarkerImage(
    "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    new window.kakao.maps.Size(36, 44),
    { offset: new window.kakao.maps.Point(18, 42) }
  );
}

export default function FinalPlaceNearby({ map, place, onFocus }) {
  const [category, setCategory] = useState("RESTAURANT");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!place?.latitude || !place?.longitude) {
      setItems([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    setItems([]);

    fetch(
      "/api/tourism?latitude=" +
        encodeURIComponent(place.latitude) +
        "&longitude=" +
        encodeURIComponent(place.longitude) +
        "&category=" +
        encodeURIComponent(category)
    )
      .then(async (response) => {
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "주변 장소 조회에 실패했습니다.");
        }
        return response.json();
      })
      .then((data) => {
        if (active) setItems(data.items ?? []);
      })
      .catch((fetchError) => {
        console.error("최종 장소 주변 정보 조회 실패", fetchError);
        if (active) setError(fetchError.message || "주변 장소를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [place?.placeId, place?.latitude, place?.longitude, category]);

  useEffect(() => {
    if (!map || !window.kakao?.maps || !place) return undefined;

    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

    const config = CATEGORIES[category];
    const markers = [];
    const infoWindows = [];

    items.forEach((item) => {
      const itemLatitude = Number(item.latitude);
      const itemLongitude = Number(item.longitude);
      if (!Number.isFinite(itemLatitude) || !Number.isFinite(itemLongitude)) return;
      if (
        Math.abs(itemLatitude - latitude) < 0.00008 &&
        Math.abs(itemLongitude - longitude) < 0.00008
      ) return;

      const marker = new window.kakao.maps.Marker({
        map,
        position: new window.kakao.maps.LatLng(itemLatitude, itemLongitude),
        image: makeMarkerImage(category),
        title: item.title || config.label,
        zIndex: 2,
      });
      const details = [
        item.address ? escapeHtml(item.address) : "",
        item.phone ? escapeHtml(item.phone) : "",
      ].filter(Boolean);
      const infoWindow = new window.kakao.maps.InfoWindow({
        zIndex: 1000,
        content:
          '<div class="info-window nearby-marker-info" style="min-width:150px;max-width:230px;padding:10px 12px;background:#fff;border:1px solid #e3e5df;border-radius:8px;box-shadow:0 4px 16px rgba(25,35,27,.18)">' +
          '<div style="margin-bottom:5px;color:' + config.color + ';font-size:10px;font-weight:800">' + config.label + "</div>" +
          '<strong style="font-size:13px">' + escapeHtml(item.title || config.label) + "</strong>" +
          (details.length ? '<div style="margin-top:4px;color:#687168;font-size:11px;line-height:1.5">' + details.join("<br/>") + "</div>" : "") +
          "</div>",
      });

      window.kakao.maps.event.addListener(marker, "mouseover", () => {
        infoWindow.setZIndex(1000);
        infoWindow.open(map, marker);
      });
      window.kakao.maps.event.addListener(marker, "mouseout", () => infoWindow.close());
      window.kakao.maps.event.addListener(marker, "click", () => {
        onFocus(itemLatitude, itemLongitude);
        window.open(
          "https://search.naver.com/search.naver?query=" + encodeURIComponent(item.title || config.label),
          "_blank",
          "noopener,noreferrer"
        );
      });
      markers.push(marker);
      infoWindows.push(infoWindow);
    });

    return () => {
      infoWindows.forEach((infoWindow) => infoWindow.close());
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [map, place?.placeId, place?.latitude, place?.longitude, category, items, onFocus]);

  const config = CATEGORIES[category];

  return (
    <section className="final-nearby panel" aria-label="최종 약속장소 주변 정보">
      <div className="final-nearby-heading">
        <div>
          <span className="final-nearby-eyebrow">NEAR THE FINAL PLACE</span>
          <h2>최종 장소 주변</h2>
          <p>맛집 또는 관광지를 선택하면 해당 종류의 마커만 지도에 표시됩니다.</p>
        </div>
        <span className="final-nearby-count">{items.length}곳</span>
      </div>
      <div className="final-nearby-tabs" role="group" aria-label="주변 장소 종류">
        <button
          type="button"
          className={category === "RESTAURANT" ? "active" : ""}
          aria-pressed={category === "RESTAURANT"}
          onClick={() => setCategory("RESTAURANT")}
        >
          🍽️ 맛집
        </button>
        <button
          type="button"
          className={category === "TOURIST" ? "active" : ""}
          aria-pressed={category === "TOURIST"}
          onClick={() => setCategory("TOURIST")}
        >
          🏛️ 관광지
        </button>
      </div>
      <div className="final-nearby-list" aria-live="polite">
        {loading ? (
          <div className="final-nearby-empty">주변 장소를 불러오는 중...</div>
        ) : error ? (
          <div className="final-nearby-empty">{error}</div>
        ) : items.length === 0 ? (
          <div className="final-nearby-empty">주변 2km 안에 표시할 {config.label} 정보가 없습니다.</div>
        ) : (
          items.map((item, index) => (
            <button
              type="button"
              className="final-nearby-item"
              key={item.contentId || item.placeUrl || item.title + "-" + index}
              onClick={() => {
                const latitude = Number(item.latitude);
                const longitude = Number(item.longitude);
                if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                  onFocus(latitude, longitude);
                }
                if (item.title) {
                  const searchQuery = item.title;
                  window.open(
                    "https://search.naver.com/search.naver?query=" + encodeURIComponent(searchQuery),
                    "_blank",
                    "noopener,noreferrer"
                  );
                }
              }}
            >
              {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="final-nearby-item-icon">{category === "RESTAURANT" ? "🍽️" : "🏛️"}</span>}
              <span className="final-nearby-item-copy">
                <strong>{item.title || config.label}</strong>
                {item.address && <small>{item.address}</small>}
                {item.phone && <small>{item.phone}</small>}
              </span>
              <span className="final-nearby-item-arrow" aria-hidden="true">↗</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
