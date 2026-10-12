const FINISH_BUTTON_ID = "meetup-vote-finish-button";
const RESULT_CLASS = "final-place-result";
let currentRoom = null;
let currentUser = null;
let lastFinishedPlaceId = null;
let ladderShowing = false;

const getRoomId = () => Number(localStorage.getItem("meetupRoomId")) || null;

const refreshCandidateIds = async () => {
  const roomId = getRoomId();
  if (!roomId) return;

  try {
    const response = await fetch(`/api/place-candidates/room/${roomId}`, { cache: "no-store" });
    if (!response.ok) return;
    const candidates = await response.json();

    document.querySelectorAll(".candidate-panel .candidate-item").forEach((card) => {
      const name = card.querySelector(".candidate-info strong")?.textContent?.trim();
      const candidate = candidates.find((item) => item.placeName === name);
      if (candidate) card.dataset.placeId = candidate.placeId;
    });
  } catch (error) {
    console.error("후보 ID 조회 실패", error);
  }
};

const getCandidates = () => {
  return [...document.querySelectorAll(".candidate-panel .candidate-item")]
    .map((card) => {
      const name = card.querySelector(".candidate-info strong")?.textContent?.trim();
      const voteText = card.querySelector(".candidate-info b")?.textContent || "";
      const voteMatch = voteText.match(/(\d+)표/);
      const votes = voteMatch ? Number(voteMatch[1]) : 0;
      const address = card.querySelector(".candidate-info span")?.textContent?.trim() || "";
      const placeId = Number(card.dataset.placeId);
      return name && placeId ? { name, address, votes, placeId } : null;
    })
    .filter(Boolean);
};

const findCandidateByPlaceId = (placeId) =>
  getCandidates().find((candidate) => candidate.placeId === Number(placeId)) || null;

const renderFinalPlace = (place) => {
  if (!place) return;
  const panel = document.querySelector(".candidate-panel");
  if (!panel) return;

  let result = panel.querySelector(`.${RESULT_CLASS}`);
  if (!result) {
    result = document.createElement("div");
    result.className = RESULT_CLASS;
    panel.appendChild(result);
  }

  result.innerHTML = `
    <span>🎉 최종 약속장소</span>
    <strong>${place.name}</strong>
    <small>${place.address}</small>
  `;

  panel.querySelectorAll(".candidate-item > button").forEach((button) => {
    button.disabled = true;
    button.textContent = "마감";
  });
  panel.querySelector(`#${FINISH_BUTTON_ID}`)?.remove();
};

const createRungs = (count, rows = 8) => {
  const rungs = [];
  for (let row = 0; row < rows; row += 1) {
    const used = new Set();
    Array.from({ length: Math.max(0, count - 1) }, (_, index) => index)
      .sort(() => Math.random() - 0.5)
      .forEach((column) => {
        if (used.has(column) || used.has(column - 1) || used.has(column + 1)) return;
        if (Math.random() < 0.58) {
          rungs.push({ row, column });
          used.add(column);
        }
      });
  }
  return rungs;
};

const tracePath = (start, count, rungs, rows) => {
  let column = start;
  const path = [{ row: 0, column }];

  for (let row = 0; row < rows; row += 1) {
    const right = rungs.find((item) => item.row === row && item.column === column);
    const left = rungs.find((item) => item.row === row && item.column === column - 1);

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
};

const buildLadder = (candidates, winnerIndex) => {
  const count = candidates.length;
  const rows = 8;
  const width = Math.max(300, count * 110);
  const height = 390;
  const x = (column) => 35 + (width - 70) * (column / Math.max(1, count - 1));
  const y = (row) => 52 + (height - 92) * (row / rows);

  let start = winnerIndex;
  let rungs = createRungs(count, rows);
  let result = tracePath(start, count, rungs, rows);

  for (let attempt = 0; attempt < 100 && result.winnerIndex !== winnerIndex; attempt += 1) {
    start = Math.floor(Math.random() * count);
    rungs = createRungs(count, rows);
    result = tracePath(start, count, rungs, rows);
  }

  const points = result.path.map((point) => `${x(point.column)},${y(point.row)}`).join(" ");
  const verticals = Array.from({ length: count }, (_, column) =>
    `<line x1="${x(column)}" y1="52" x2="${x(column)}" y2="${height - 40}" class="ladder-line" />`
  ).join("");
  const horizontalRungs = rungs.map((rung) =>
    `<line x1="${x(rung.column)}" y1="${y(rung.row + 0.5)}" x2="${x(rung.column + 1)}" y2="${y(rung.row + 0.5)}" class="ladder-rung" />`
  ).join("");
  const labels = candidates.map((candidate, index) =>
    `<div class="ladder-top-label" style="left:${(x(index) / width) * 100}%">${candidate.name}</div>`
  ).join("");

  return {
    winner: candidates[winnerIndex],
    html: `
      <div class="ladder-board" style="width:${width}px">
        <div class="ladder-top-labels">${labels}</div>
        <svg class="ladder-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="사다리 게임">
          ${verticals}
          ${horizontalRungs}
          <polyline points="${points}" class="ladder-path" />
          <circle cx="${x(start)}" cy="52" r="8" class="ladder-start" />
          <circle cx="${x(result.winnerIndex)}" cy="${height - 40}" r="9" class="ladder-end" />
        </svg>
        <div class="ladder-bottom-labels">
          ${candidates.map((candidate, index) => `<div>${index === winnerIndex ? "🎉 최종 장소" : candidate.name}</div>`).join("")}
        </div>
      </div>
    `,
  };
};

const showTieLadder = (candidates, winnerIndex) => {
  if (ladderShowing) return;
  ladderShowing = true;

  const ladder = buildLadder(candidates, winnerIndex);
  const modal = document.createElement("div");
  modal.className = "vote-finish-modal";
  modal.innerHTML = `
    <div class="vote-finish-card ladder-card">
      <div class="vote-finish-header">
        <div>
          <span class="vote-finish-eyebrow">VOTE TIE BREAK</span>
          <h3>⚡ 동점입니다!</h3>
          <p>최다 득표 후보가 같아 사다리 게임으로 최종 장소를 결정합니다.</p>
        </div>
        <button type="button" class="vote-finish-close" aria-label="닫기">×</button>
      </div>
      <div class="ladder-candidates">
        ${candidates.map((candidate) => `<span>${candidate.name}</span>`).join("")}
      </div>
      <div class="ladder-stage">${ladder.html}</div>
      <div class="ladder-status">사다리를 타는 중...</div>
      <div class="ladder-result" aria-live="polite"></div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => {
    ladderShowing = false;
    modal.remove();
  };

  modal.querySelector(".vote-finish-close").addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  requestAnimationFrame(() => modal.querySelector(".ladder-path")?.classList.add("running"));

  setTimeout(() => {
    modal.querySelector(".ladder-status").textContent = "사다리 게임 결과가 나왔습니다!";
    modal.querySelector(".ladder-result").innerHTML = `
      <strong>🎉 ${ladder.winner.name}</strong>
      <span>${ladder.winner.address}</span>
      <em>최종 약속장소로 결정되었습니다.</em>
    `;
  }, 3600);
};

const loadRoomAndUser = async () => {
  const roomId = getRoomId();
  if (!roomId) return false;

  try {
    const [roomResponse, userResponse] = await Promise.all([
      fetch(`/api/rooms/${roomId}`, { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
    ]);

    if (!roomResponse.ok || !userResponse.ok) return false;
    currentRoom = await roomResponse.json();
    currentUser = await userResponse.json();
    return true;
  } catch (error) {
    console.error("투표 마감 준비 실패", error);
    return false;
  }
};

const getVoteResult = async () => {
  const roomId = getRoomId();
  if (!roomId) return null;

  try {
    const response = await fetch(`/api/rooms/${roomId}/vote-result`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("투표 결과 조회 실패", error);
    return null;
  }
};

const applyVoteResult = (result, animateTie = false) => {
  if (!result?.finished || !result.finalPlaceId) return;

  const place = findCandidateByPlaceId(result.finalPlaceId);
  if (!place) return;

  renderFinalPlace(place);

  if (animateTie && result.tie) {
    const candidates = getCandidates();
    const maxVotes = Math.max(...candidates.map((candidate) => candidate.votes));
    const tiedCandidates = candidates.filter((candidate) => candidate.votes === maxVotes);
    const winnerIndex = tiedCandidates.findIndex(
      (candidate) => candidate.placeId === Number(result.finalPlaceId)
    );

    if (winnerIndex >= 0 && tiedCandidates.length > 1) {
      showTieLadder(tiedCandidates, winnerIndex);
    }
  }
};

const finishVote = async () => {
  const roomId = getRoomId();
  if (!roomId) return;

  await refreshCandidateIds();
  const candidates = getCandidates();
  if (candidates.length === 0) {
    alert("후보 장소를 먼저 등록해주세요.");
    return;
  }

  const button = document.getElementById(FINISH_BUTTON_ID);
  if (button) {
    button.disabled = true;
    button.textContent = "투표 마감 처리 중...";
  }

  try {
    const response = await fetch(`/api/rooms/${roomId}/vote-finish?userId=${currentUser?.userId ?? ""}`, {
      method: "POST",
    });

    const message = await response.text();
    if (!response.ok) throw new Error(message || "투표 마감에 실패했습니다.");

    const result = JSON.parse(message);
    const finalCandidate = findCandidateByPlaceId(result.finalPlaceId);
    if (!finalCandidate) throw new Error("최종 장소 정보를 찾을 수 없습니다.");

    applyVoteResult(result, result.tie);
    lastFinishedPlaceId = Number(result.finalPlaceId);
    currentRoom.voteFinishedAt = result.finishedAt;
    currentRoom.finalPlaceId = result.finalPlaceId;

    if (!result.tie) {
      alert(`${finalCandidate.name}이(가) 최종 약속장소로 결정되었습니다!`);
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "투표 마감에 실패했습니다.");
    if (button) {
      button.disabled = false;
      button.textContent = "🗳️ 투표 마감하고 최종 장소 정하기";
    }
  }
};

const ensureFinishButton = () => {
  const panel = document.querySelector(".candidate-panel");
  if (!panel || !currentRoom) return;

  if (currentRoom.voteFinishedAt || lastFinishedPlaceId) return;
  if (!currentUser) return;
  if (Number(currentRoom.creatorId) !== Number(currentUser.userId)) return;
  if (panel.querySelector(`#${FINISH_BUTTON_ID}`)) return;

  const button = document.createElement("button");
  button.id = FINISH_BUTTON_ID;
  button.type = "button";
  button.textContent = "🗳️ 투표 마감하고 최종 장소 정하기";
  button.addEventListener("click", finishVote);
  panel.appendChild(button);
};

const syncVoteResult = async () => {
  await refreshCandidateIds();
  const result = await getVoteResult();
  if (!result?.finished) {
    ensureFinishButton();
    return;
  }

  lastFinishedPlaceId = Number(result.finalPlaceId);
  applyVoteResult(result, false);
};

const boot = async () => {
  if (!getRoomId()) return;
  await loadRoomAndUser();
  await refreshCandidateIds();
  ensureFinishButton();
  await syncVoteResult();
};

const observer = new MutationObserver(() => {
  ensureFinishButton();
  if (lastFinishedPlaceId) {
    const place = findCandidateByPlaceId(lastFinishedPlaceId);
    if (place) renderFinalPlace(place);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("load", boot);
boot();
setInterval(async () => {
  if (!currentRoom || !currentUser) {
    await loadRoomAndUser();
  }
  ensureFinishButton();
  await syncVoteResult();
}, 3000);
