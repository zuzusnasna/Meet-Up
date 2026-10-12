export default function ParticipantsPanel({ participants, userId }) {
  return (
    <section className="panel participants-panel">
      <div className="panel-title">
        <div>
          <h2>👥 참여자</h2>
          <span>{participants.length}명 참여 중</span>
        </div>
      </div>
      {participants.length === 0 ? (
        <div className="empty-state">
          <span>👤</span>
          <p>아직 참여자가 없습니다.</p>
        </div>
      ) : (
        <div className="participant-list">
          {participants.map((participant) => (
            <div
              className="participant-item"
              key={participant.roomId + "-" + participant.userId}
            >
              <span className="participant-avatar">👤</span>
              <div>
                <strong>{participant.userName || "참여자"}</strong>
                <span>{participant.userId === userId ? "나" : "참여자"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
