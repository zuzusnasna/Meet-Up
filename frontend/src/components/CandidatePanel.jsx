import { useEffect, useMemo, useState } from "react";
import FinalPlaceMarker from "./FinalPlaceMarker";

function tracePath(start, count, rungs, rows) {
  let column = start;
  const path = [{ row: 0, column }];

  for (let row = 0; row < rows; row += 1) {
    const right = rungs.find((rung) => rung.row === row && rung.column === column);
    const left = rungs.find((rung) => rung.row === row && rung.column === column - 1);

    if (right) {
      path.push({ row: row + 0.5, column });
      column += 1;
      path.push({ row: row + 1, column });
    } else if (left) {
      path.push({ row: row + 0.5, column });
      column -= 1;
      path.push({ row: row + 1, column });
    } else {
      path.push({ row: row + 1, column });
    }
  }

  return { path, winnerIndex: Math.max(0, Math.min(count - 1, column)) };
}

function LadderModal({ candidates, winnerId, onClose }) {
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const ladder = useMemo(() => {
    const count = candidates.length;
    const rows = 8;
    const winnerIndex = Math.max(
      0,
      candidates.findIndex((candidate) => Number(candidate.placeId) === Number(winnerId))
    );
    const createRungs = () => {
      const rungs = [];
      for (let row = 0; row < rows; row += 1) {
        const used = new Set();
        for (let column = 0; column < count - 1; column += 1) {
          if (used.has(column - 1) || used.has(column) || used.has(column + 1)) continue;
          if (Math.random() < 0.58) {
            rungs.push({ row, column });
            used.add(column);
          }
        }
      }
      return rungs;
    };

    let startIndex = winnerIndex;
    let rungs = createRungs();
    let trace = tracePath(startIndex, count, rungs, rows);
    for (let attempt = 0; attempt < 100 && trace.winnerIndex !== winnerIndex; attempt += 1) {
      startIndex = Math.floor(Math.random() * count);
      rungs = createRungs();
      trace = tracePath(startIndex, count, rungs, rows);
    }

    const width = Math.max(300, count * 110);
    const height = 390;
    const x = (column) => 35 + ((width - 70) * column) / Math.max(1, count - 1);
    const y = (row) => 52 + ((height - 92) * row) / rows;
    return {
      count,
      rows,
      width,
      height,
      rungs,
      startIndex,
      winnerIndex,
      points: trace.path.map((point) => `${x(point.column)},${y(point.row)}`).join(" "),
      x,
      y,
    };
  }, [candidates, winnerId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRunning(true));
    const timer = window.setTimeout(() => setComplete(true), 3600);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  const winner = candidates.find((candidate) => Number(candidate.placeId) === Number(winnerId));

  return (
    <div
      className="vote-finish-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tie-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
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
          <div className="ladder-board" style={{ width: ladder.width }}>
            <div className="ladder-top-labels">
              {candidates.map((candidate, index) => (
                <div className="ladder-top-label" key={candidate.placeId} style={{ left: `${(ladder.x(index) / ladder.width) * 100}%` }}>
                  {candidate.placeName}
                </div>
              ))}
            </div>
            <svg className="ladder-svg" viewBox={`0 0 ${ladder.width} ${ladder.height}`} role="img" aria-label="사다리 게임">
              {candidates.map((candidate, index) => (
                <line key={`v-${candidate.placeId}`} x1={ladder.x(index)} y1="52" x2={ladder.x(index)} y2={ladder.height - 40} className="ladder-line" />
              ))}
              {ladder.rungs.map((rung, index) => (
                <line key={index} x1={ladder.x(rung.column)} y1={ladder.y(rung.row + 0.5)} x2={ladder.x(rung.column + 1)} y2={ladder.y(rung.row + 0.5)} className="ladder-rung" />
              ))}
              <polyline points={ladder.points} className={`ladder-path ${running ? "running" : ""}`} />
              <circle cx={ladder.x(ladder.startIndex)} cy="52" r="8" className="ladder-start" />
              <circle cx={ladder.x(ladder.winnerIndex)} cy={ladder.height - 40} r="9" className="ladder-end" />
            </svg>
            <div className="ladder-bottom-labels">
              {candidates.map((candidate, index) => (
                <div key={candidate.placeId}>{index === ladder.winnerIndex ? "🎉 최종 장소" : candidate.placeName}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="ladder-status">{complete ? "사다리 게임 결과가 나왔습니다!" : "사다리를 타는 중..."}</div>
        {complete && (
          <div className="ladder-result" aria-live="polite">
            <strong>🎉 {winner?.placeName || "최종 장소"}</strong>
            <span>{winner?.address}</span>
            <em>최종 약속장소로 결정되었습니다.</em>
          </div>
        )}
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
  onFinalPlaceChange,
}) {
  const [voteResult, setVoteResult] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [showLadder, setShowLadder] = useState(false);

  useEffect(() => {
    if (!roomId) {
      setVoteResult(null);
      return undefined;
    }

    let active = true;
    setVoteResult(null);

    fetch(`/api/rooms/${roomId}/vote-result`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((result) => {
        if (active && result?.finished && result.finalPlaceId) setVoteResult(result);
      })
      .catch((error) => console.error("투표 결과 조회 실패", error));

    return () => { active = false; };
  }, [roomId]);

  const finalPlace = candidates.find(
    (candidate) => Number(candidate.placeId) === Number(voteResult?.finalPlaceId)
  );

  useEffect(() => {
    onFinalPlaceChange?.(voteResult?.finished ? finalPlace ?? null : null);
  }, [voteResult?.finished, finalPlace?.placeId, finalPlace?.placeName, finalPlace?.latitude, finalPlace?.longitude, finalPlace?.address, onFinalPlaceChange]);

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
          <button
            type="button"
            className="final-place-directions-button"
            onClick={() => onSetRouteTarget?.(finalPlace)}
          >
            🧭 최종 목적지까지 길찾기
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
