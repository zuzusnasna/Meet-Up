import { useEffect } from "react";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const nearbyMarkerImage = (category) => {
  const isTourist = category === "TOURIST";
  const color = isTourist ? "#356b4a" : "#b95e35";
  const label = isTourist ? "관" : "맛";
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">' +
    '<path d="M18 1.5C8.9 1.5 2 8.4 2 17.1c0 11 16 25 16 25s16-14 16-25C34 8.4 27.1 1.5 18 1.5Z" fill="' + color + '" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="18" cy="17" r="10.5" fill="#fff"/>' +
    '<text x="18" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="' + color + '">' + label + '</text>' +
    "</svg>";
  const src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  return new window.kakao.maps.MarkerImage(
    src,
    new window.kakao.maps.Size(36, 44),
    { offset: new window.kakao.maps.Point(18, 42) }
  );
};

export default function FinalPlaceMarker({ map, place, onFocus }) {
  useEffect(() => {
    if (!map || !place || !window.kakao?.maps) return undefined;

    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

    let active = true;
    const markers = [];
    const infoWindows = [];
    const position = new window.kakao.maps.LatLng(latitude, longitude);
    const marker = new window.kakao.maps.Marker({ map, position });
    const infoWindow = new window.kakao.maps.InfoWindow({
      content: `<div class="info-window"><strong>최종 약속장소</strong><br/>${escapeHtml(
        place.placeName || "최종 장소"
      )}<br/>${escapeHtml(place.address || "")}</div>`,
    });

    window.kakao.maps.event.addListener(marker, "click", () => {
      onFocus(latitude, longitude);
      infoWindow.open(map, marker);
    });

    const loadNearbyMarkers = async (category) => {
      try {
        const response = await fetch(
          "/api/tourism?latitude=" +
            encodeURIComponent(latitude) +
            "&longitude=" +
            encodeURIComponent(longitude) +
            "&category=" +
            encodeURIComponent(category)
        );
        if (!response.ok) {
          throw new Error("주변 장소 조회에 실패했습니다: " + category);
        }

        const data = await response.json();
        if (!active) return;

        (data.items ?? []).forEach((item) => {
          const itemLatitude = Number(item.latitude);
          const itemLongitude = Number(item.longitude);
          if (!Number.isFinite(itemLatitude) || !Number.isFinite(itemLongitude)) return;

          // 목적지 자체와 겹치는 좌표는 별도 마커로 표시하지 않습니다.
          if (
            Math.abs(itemLatitude - latitude) < 0.00008 &&
            Math.abs(itemLongitude - longitude) < 0.00008
          ) return;

          const itemPosition = new window.kakao.maps.LatLng(itemLatitude, itemLongitude);
          const itemMarker = new window.kakao.maps.Marker({
            map,
            position: itemPosition,
            image: nearbyMarkerImage(category),
            title: item.title || (category === "TOURIST" ? "관광지" : "맛집"),
            zIndex: 1,
          });
          const categoryLabel = category === "TOURIST" ? "관광지" : "맛집";
          const detailRows = [
            item.address ? escapeHtml(item.address) : "",
            item.phone ? escapeHtml(item.phone) : "",
          ].filter(Boolean);
          const itemInfoWindow = new window.kakao.maps.InfoWindow({
            zIndex: 1000,
            content:
              '<div class="info-window nearby-marker-info" style="position:relative;z-index:1000;min-width:150px;max-width:230px;padding:10px 12px;background:#fff;border:1px solid #e3e5df;border-radius:8px;box-shadow:0 4px 16px rgba(25,35,27,.18)">' +
              '<div style="margin-bottom:5px;color:' + (category === "TOURIST" ? "#356b4a" : "#b95e35") +
              ';font-size:10px;font-weight:800">' + categoryLabel + "</div>" +
              '<strong style="font-size:13px">' + escapeHtml(item.title || categoryLabel) + "</strong>" +
              (detailRows.length ? '<div style="margin-top:4px;color:#687168;font-size:11px;line-height:1.5">' + detailRows.join("<br/>") + "</div>" : "") +
              "</div>",
          });

          window.kakao.maps.event.addListener(itemMarker, "mouseover", () => {
            itemInfoWindow.setZIndex(1000);
            itemInfoWindow.open(map, itemMarker);
          });
          window.kakao.maps.event.addListener(itemMarker, "mouseout", () => {
            itemInfoWindow.close();
          });
          window.kakao.maps.event.addListener(itemMarker, "click", () => {
            const searchQuery = [item.title, item.address]
              .filter(Boolean)
              .join(" ");
            const naverSearchUrl =
              "https://search.naver.com/search.naver?query=" +
              encodeURIComponent(searchQuery || item.title || categoryLabel);
            window.open(naverSearchUrl, "_blank", "noopener,noreferrer");
          });

          markers.push(itemMarker);
          infoWindows.push(itemInfoWindow);
        });
      } catch (error) {
        console.error("주변 " + (category === "TOURIST" ? "관광지" : "맛집") + " 마커 조회 실패", error);
      }
    };

    loadNearbyMarkers("TOURIST");
    loadNearbyMarkers("RESTAURANT");

    return () => {
      active = false;
      infoWindows.forEach((windowInstance) => windowInstance.close());
      markers.forEach((nearbyMarker) => nearbyMarker.setMap(null));
      infoWindow.close();
      marker.setMap(null);
    };
  }, [
    map,
    place?.placeId,
    place?.latitude,
    place?.longitude,
    place?.placeName,
    place?.address,
    onFocus,
  ]);

  return null;
}
