export default function RoomEntry({
  authLoading,
  currentUser,
  inviteRoomId,
  roomName,
  setRoomName,
  roomInput,
  setRoomInput,
  roomLoading,
  onCreateRoom,
  onJoinRoom,
}) {
  if (authLoading) {
    return (
      <div className="room-entry">
        <div className="room-entry-card">
          <p>로그인 정보를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="room-entry">
        <div className="room-entry-card">
          <p className="eyebrow">LOCATION · VOTE · MEET</p>
          <h1>Meet-Up</h1>
          <p className="room-entry-description">소셜 계정으로 로그인하고 모임을 시작하세요.</p>
          <div className="social-login-buttons">
            <a href="/oauth2/authorization/kakao">🟡 카카오 로그인</a>
            <a href="/oauth2/authorization/naver">🟢 네이버 로그인</a>
            <a href="/oauth2/authorization/google">⚪ Google 로그인</a>
          </div>
        </div>
      </div>
    );
  }

  if (inviteRoomId) {
    return (
      <div className="room-entry">
        <div className="room-entry-card">
          <p className="eyebrow">INVITED TO MEET-UP</p>
          <h1>Meet-Up</h1>
          <p className="room-entry-description">초대받은 모임에 참여하세요.</p>
          <div className="room-entry-section">
            <h2>🎉 모임 참여</h2>
            <p>초대받은 모임의 참여 코드가 입력되어 있습니다. 방을 새로 만들 수는 없습니다.</p>
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onJoinRoom();
              }}
              placeholder="참여 코드를 입력하세요"
              inputMode="numeric"
            />
            <button onClick={onJoinRoom} disabled={roomLoading}>
              {roomLoading ? "입장 중..." : "모임 참여하기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="room-entry">
      <div className="room-entry-card">
        <p className="eyebrow">LOCATION · VOTE · MEET</p>
        <h1>Meet-Up</h1>
        <p className="room-entry-description">모임방을 만들거나 기존 모임방에 입장하세요.</p>
        <div className="room-entry-section">
          <h2>새 모임 만들기</h2>
          <input
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCreateRoom();
            }}
            placeholder="예: 친구들과 서울 모임"
            maxLength={200}
          />
          <button onClick={onCreateRoom} disabled={roomLoading}>
            {roomLoading ? "처리 중..." : "모임 만들기"}
          </button>
        </div>
        <div className="room-entry-divider"><span>또는</span></div>
        <div className="room-entry-section">
          <h2>기존 모임방 입장</h2>
          <input
            value={roomInput}
            onChange={(event) => setRoomInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onJoinRoom();
            }}
            placeholder="모임방 ID를 입력하세요"
            inputMode="numeric"
          />
          <button onClick={onJoinRoom} disabled={roomLoading}>
            {roomLoading ? "처리 중..." : "입장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
