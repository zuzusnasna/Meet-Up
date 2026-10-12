import { useEffect, useMemo, useState } from "react";
import FinalPlaceMarker from "./FinalPlaceMarker";

function LadderModal({ candidates, winnerId, onClose }) {
  const winner = candidates.find((candidate) => Number(candidate.placeId) === Number(winnerId));
  const columns = Math.max(candidates.length, 2);
  const width = Math.max(300, columns * 110);
  const x = (index) => 35 + ((width - 70) * index) / (columns - 1);
  const rungs = useMemo(() => {
    const generated = [];
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < candidates.length - 1; column += 1) {
        if (Math.random() > 0.62) {
          if (generated.some((rung) => rung.row === row && Math.abs(rung.column - column) <= 1)) continue;
          generated.push({ row, column });
        }
      }
    }
    return generated;
  }, [candidates.length]);

  return (
    <div className="vote-finish-modal" role="dialog" aria-modal="true" aria-labelledby="tie-title" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="vote-finish-card ladder-card">
        <div className="vote-finish-header">
          <div>
            <span className="vote-finish-eyebrow">VOTE TIE BREAK</span>
            <h3 id="tie-title">⚡ 동점입니다!</h3>
            <p>최다 득표 후보가 같아 사다리 게임으로 최종 장소를 결정했습니다.</p>
          </div>
          <button type="button" className="vote-finish-close" aria-label="닫기" onClick={onClose}>×</button>
        </div>
        <div className="ladder-candidates">
          {candidates.map((candidate) => <span key={candidate.placeId}>{candidate.placeName}</span>)}
        </div>
        <div className="ladder-stage">
          <div className="ladder-board" style={{ width }}>
            <div className="ladder-top-labels">
              {candidates.map((candidate, index) => (
                <div className="ladder-top-label" key={candidate.placeId} style={{ left: `${(x(index) / width) * 100}%` }}>
                  {candidate.placeName}
                </div>
              ))}
            </div>
            <svg className="ladder-svg" viewBox={`0 0 ${width} 390`} role="img" aria-label="사다리 게임 결과">
              {candidates.map((candidate, index) => (
                <line key={`v-${candidate.placeId}`} x1={x(index)} y1="52" x2={x(index)} y2="350" className="ladder-line" />
              ))}
              {rungs.map((rung, index) => (
                <line key={index} x1={x(rung.column)} y1={52 + (298 * (rung.row + 1)) / 9} x2={x(rung.column + 1)} y2={52 + (298 * (rung.row + 1)) / 9} className="ladder-rung" />
              ))}
              <circle cx={x(Math.max(0, candidates.findIndex((candidate) => Number(candidate.placeId) === Number(winnerId))))} cy="350" r="9" className="ladder-end" style={{ opacity: 1 }} />
            </svg>
            <div className="ladder-bottom-labels">
              {candidates.map((candidate) => (
                <div key={candidate.placeId}>{Number(candidate.placeId) === Number(winnerId) ? "🎉 최종 장소" : candidate.placeName}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="ladder-result">
          <strong>🎉 {winner?.placeName || "최종 장소"}</strong>
          <span>{winner?.address}</span>
          <em>최종 약속장소로 결정되었습니다.</em>
        </div>
      </div>
    </div>
  );
}

export default function CandidatePanel({
  roomId,
  currentRoom,
  currentUser,
  candidates,
  voteCounts,
  votingPlaceId,
  onVote,
  onOpenNearby,
  onSetRouteTarget,
  onSetMemoModal,
  onFocusMap,
  map,
}) {
  const [voteResult, setVoteResult] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [showLadder, setShowLadder] = useState(false);
  const [resultLoaded, setResultLoaded] = useState(false);

  useEffect(() => {
    if (!roomId || resultLoaded) return;
    let active = true;
    fetch(`/api/rooms/${roomId}/vote-result`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((result) => {
        if (active && result?.finished && result.finalPlaceId) setVoteResult(result);
      })
      .catch((error) => console.error("투표 결과 조회 실패", error))
      .finally(() => {
        if (active) setResultLoaded(true);
      });
    return () => { active = false; };
  }, [roomId, resultLoaded]);

  const finalPlace = candidates.find(
    (candidate) => Number(candidate.placeId) === Number(voteResult?.finalPlaceId)
  );

  const finishVote = async () => {
    if (Number(currentRoom?.creatorId) !== Number(currentUser?.userId)) {
      alert("투표 마감 권한이 없습니다.");
      return;
    }
    if (!candidates.length) {
      alert("후보 장소를 먼저 등록해주세요.");
      return;
    }
    setFinishing(true);
    try {
      const response = await fetch(
        `/api/rooms/${roomId}/vote-finish?userId=${currentUser.userId}`,
        { method: "POST" }
      );
      const body = await response.text();
      if (!response.ok) throw new Error(body || "투표 마감에 실패했습니다.");
      const result = JSON.parse(body);
      setVoteResult(result);
      if (result.tie) setShowLadder(true);
      else {
        const winner = candidates.find((candidate) => Number(candidate.placeId) === Number(result.finalPlaceId));
        alert(`${winner?.placeName || "최종 장소"}이(가) 최종 약속장소로 결정되었습니다!`);
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "투표 마감에 실패했습니다.");
    } finally {
      setFinishing(false);
    }
  };

  if (voteResult?.finished && finalPlace) {
    return (
      <>
        <section className="panel candidate-panel final-place-panel">
          <button
            type="button"
            className="final-place-result"
            onClick={() => onFocusMap(finalPlace.latitude, finalPlace.longitude)}
            aria-label="최종 약속장소 지도에서 보기"
          >
            <span>🎉 최종 약속장소</span>
            <strong>{finalPlace.placeName}</strong>
            <small>{finalPlace.address}</small>
            <b>최종 득표 {Number(voteResult.finalVoteCount) || 0}표</b>
            <small className="final-place-map-hint">눌러서 지도에서 위치 확인</small>
          </button>
        </section>
        <FinalPlaceMarker map={map} place={finalPlace} onFocus={onFocusMap} />
        {showLadder && (
          <LadderModal
            candidates={candidates.filter((candidate) => (voteCounts[candidate.placeId] ?? 0) === Math.max(...candidates.map((item) => voteCounts[item.placeId] ?? 0)))}
            winnerId={voteResult.finalPlaceId}
            onClose={() => setShowLadder(false)}
          />
        )}
      </>
    );
  }

  return (
    <section className="panel candidate-panel">
      <div className="panel-title">
        <div>
          <h2>모임 장소 후보</h2>
          <span>{candidates.length}개 후보</span>
        </div>
      </div>
      {candidates.length === 0 ? (
        <div className="empty-state">
          <span>🗳️</span>
          <p>검색한 장소를 후보로 등록하세요.</p>
        </div>
      ) : (
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <div className="candidate-item" key={candidate.placeId} onClick={() => onFocusMap(candidate.latitude, candidate.longitude)} style={{ cursor: "pointer" }}>
              <div className="candidate-info">
                <strong>{candidate.placeName}</strong>
                <span>{candidate.address}</span>
                <span>👤 {candidate.userName || "참여자"} 추천</span>
                <b>현재 {voteCounts[candidate.placeId] ?? 0}표</b>
                <div className="candidate-actions">
                  <button onClick={(event) => { event.stopPropagation(); onOpenNearby(candidate); }}>🌟 주변 정보</button>
                  <button onClick={(event) => { event.stopPropagation(); onSetRouteTarget(candidate); }}>🗺️ 길찾기</button>
                  <button onClick={(event) => {
                    event.stopPropagation();
                    onSetMemoModal({ placeId: candidate.placeId, latitude: candidate.latitude, longitude: candidate.longitude, placeName: candidate.placeName });
                  }}>📍 메모</button>
                </div>
              </div>
              <button onClick={(event) => { event.stopPropagation(); onVote(candidate.placeId); }} disabled={votingPlaceId === candidate.placeId}>
                {votingPlaceId === candidate.placeId ? "..." : "투표"}
              </button>
            </div>
          ))}
        </div>
      )}
      <button id="meetup-vote-finish-button" type="button" onClick={finishVote} disabled={finishing}>
        {finishing ? "투표 마감 처리 중..." : "🗳️ 투표 마감하고 최종 장소 정하기"}
      </button>
    </section>
  );
}
