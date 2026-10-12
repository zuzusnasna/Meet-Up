export default function RoomHeader({
  currentRoom,
  currentUser,
  isRoomOwner,
  roomId,
  inviteCopied,
  onCopyInvite,
  onLeaveRoom,
  onLogout,
}) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">LOCATION · VOTE · MEET</p>
        <h1>Meet-Up</h1>
        <p>{currentRoom?.roomName || "함께 만날 장소를 검색하고 후보를 정해보세요."}</p>
        {currentRoom?.creatorId && (
          <div className="room-owner-info">
            <span>방장</span>
            <strong>{currentRoom.creatorName || "방장"}</strong>
            <small>
              {({ KAKAO: "카카오", NAVER: "네이버", GOOGLE: "구글" }[
                String(currentRoom.creatorProvider || "").toUpperCase()
              ] || currentRoom.creatorProvider || "소셜")} 로그인
            </small>
          </div>
        )}
      </div>
      <div className="room-header-actions">
        <span>
          {currentUser.name || currentUser.email || "사용자"} ·{" "}
          {isRoomOwner ? "방장" : "참여자"} · 방 ID: {roomId}
        </span>
        <button onClick={onCopyInvite}>
          {inviteCopied ? "복사 완료!" : "🔗 초대 링크"}
        </button>
        <button onClick={onLeaveRoom}>방 나가기</button>
        <button onClick={onLogout}>로그아웃</button>
      </div>
    </header>
  );
}
