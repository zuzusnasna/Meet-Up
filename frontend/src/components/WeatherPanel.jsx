export default function WeatherPanel({
  weather,
  loading,
  getWeatherText,
  title = "현재 날씨",
  subtitle = "선택한 장소 기준",
}) {
  return (
    <section className="panel weather-panel">
      <div className="panel-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="weather-content">
        {loading ? (
          <div className="weather-loading">날씨를 불러오는 중...</div>
        ) : weather ? (
          <>
            <div className="weather-main">
              <strong>{weather.temperature_2m}°C</strong>
              <span>{getWeatherText(weather.weather_code)}</span>
            </div>
            <div className="weather-details">
              <span>습도 {weather.relative_humidity_2m}%</span>
              <span>강수량 {weather.precipitation}mm</span>
              <span>바람 {weather.wind_speed_10m}km/h</span>
            </div>
          </>
        ) : (
          <div className="weather-loading">날씨 정보를 가져오지 못했습니다.</div>
        )}
      </div>
    </section>
  );
}
