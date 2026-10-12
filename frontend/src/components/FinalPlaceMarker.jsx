import { useEffect } from "react";

export default function FinalPlaceMarker({ map, place, onFocus }) {
  useEffect(() => {
    if (!map || !place || !window.kakao?.maps) return undefined;

    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

    const position = new window.kakao.maps.LatLng(latitude, longitude);
    const marker = new window.kakao.maps.Marker({ map, position });
    const infoWindow = new window.kakao.maps.InfoWindow({
      content: `<div class="info-window"><strong>🎉 최종 약속장소</strong><br/>${String(
        place.placeName || "최종 장소"
      )}<br/>${String(place.address || "")}</div>`,
    });

    window.kakao.maps.event.addListener(marker, "click", () => {
      onFocus(latitude, longitude);
      infoWindow.open(map, marker);
    });

    return () => {
      infoWindow.close();
      marker.setMap(null);
    };
  }, [map, place?.placeId, place?.latitude, place?.longitude, place?.placeName, place?.address, onFocus]);

  return null;
}
