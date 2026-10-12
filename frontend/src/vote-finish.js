const FINISH_BUTTON_ID = "meetup-vote-finish-button";
const MODAL_ID = "meetup-vote-finish-modal";
const FINAL_KEY_PREFIX = "meetupFinalPlace:";

const getRoomId = () => {
  const params = new URLSearchParams(window.location.search);
  const urlRoomId = Number(params.get("roomId"));
  if (urlRoomId) return urlRoomId;

  const savedRoomId = Number(localStorage.getItem("meetupRoomId"));
  return savedRoomId || null;
};

const getFinalStorageKey = () => {
  const roomId = getRoomId();
  return roomId ? FINAL_KEY_PREFIX + roomId : null;
};

const isOwner = () => document.querySelector(".room-header-actions span")?.textContent.includes("방장");

const getCandidates = () => {
  return [...document.querySelectorAll(".candidate-panel .candidate-item")]
    .map((card) => {
      const name = card.querySelector(".candidate-info strong")?.textContent?.trim();
      const voteText = card.querySelector(".candidate-info b")?.textContent || "";
      const voteMatch = voteText.match(/(\d+)표/);
      const votes = voteMatch ? Number(voteMatch[1]) : 0;
      const address = card.querySelector(".candidate-info span")?.textContent?.trim() || "";
      return name ? { name, address, votes } : null;
    })
    .filter(Boolean);
};

const closeModal = () => {
  document.getElementById(MODAL_ID)?.remove();
};

const createRungs = (count, rows = 8) => {
  const rungs = [];
  for (let row = 0; row < rows; row += 1) {
    const shuffled = Array.from({ length: Math.max(0, count - 1) }, (_, index) => index)
      .sort(() => Math.random() - 0.5);
    const used = new Set();
    shuffled.forEach((column) => {
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
    const rung = rungs.find((item) => item.row === row && item.column === column);
    const leftRung = rungs.find((item) => item.row === row && item.column === column - 1);
    if (rung) {
      path.push({ row: row + 0.5, column });
      column += 1;
      path.push({ row: row + 1, column });
    } else if (leftRung) {
      path.push({ row: row + 0.5, column });
      column -= 1;
      path.push({ row: row + 1, column });
    } else {
      path.push({ row: row + 1, column });
    }
  }
  return { path, winnerIndex: Math.max(0, Math.min(count - 1, column)) };
};

const buildLadder = (candidates) => {
  const count = candidates.length;
  const rows = 8;
  const width = Math.max(300, count * 110);
  const height = 390;
  const x = (column) => 35 + (width - 70) * (column / Math.max(1, count - 1));
  const y = (row) => 52 + (height - 92) * (row / rows);
  const rungs = createRungs(count, rows);
  const start = Math.floor(Math.random() * count);
  const result = tracePath(start, count, rungs, rows);
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
    winnerIndex: result.winnerIndex,
    winner: candidates[result.winnerIndex],
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
          ${candidates.map((candidate, index) => `<div>${index === result.winnerIndex ? "🎉 최종 장소" : "다른 후보"}</div>`).join("")}
        </div>
      </div>
    `,
  };
};

const showTieLadder = (candidates) => {
  const ladder = buildLadder(candidates);
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "vote-finish-modal";
  modal.innerHTML = `
    <div class="vote-finish-card ladder-card">
      <div class="vote-finish-header">
        <div>
          <span class="vote-finish-eyebrow">VOTE TIE BREAK</span>
          <h3>⚡ 동점입니다!</h3>
          <p>투표가 같은 후보들을 사다리 게임으로 결정합니다.</p>
        </div>
        <button type="button" class="vote-finish-close" aria-label="닫기">×</button>
      </div>
      <div class="ladder-candidates">
        ${candidates.map((candidate) => `<span>${candidate.name}</span>`).join("")}
      </div>
      <div class="ladder-stage">
        ${ladder.html}
      </div>
      <div class="ladder-status">사다리를 타는 중...</div>
      <div class="ladder-result" aria-live="polite"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".vote-finish-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  requestAnimationFrame(() => {
    const path = modal.querySelector(".ladder-path");
    if (path) path.classList.add("running");
  });

  setTimeout(() => {
    const status = modal.querySelector(".ladder-status");
    const result = modal.querySelector(".ladder-result");
    if (status) status.textContent = "사다리 게임 결과가 나왔습니다!";
    if (result) {
      result.innerHTML = `<strong>🎉 ${ladder.winner.name}</strong><span>${ladder.winner.address}</span><em>최종 약속장소로 결정되었습니다.</em>`;
    }
    saveFinalPlace(ladder.winner);
  }, 3600);
};

const saveFinalPlace = (place) => {
  const key = getFinalStorageKey();
  if (!key || !place) return;
  localStorage.setItem(key, JSON.stringify(place));
  renderFinalPlace(place);
};

const loadFinalPlace = () => {
  const key = getFinalStorageKey();
  if (!key) return null;
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const renderFinalPlace = (place) => {
  const panel = document.querySelector(".candidate-panel");
  if (!panel || !place) return;

  let result = panel.querySelector(".final-place-result");
  if (!result) {
    result = document.createElement("div");
    result.className = "final-place-result";
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

const finishVote = () => {
  if (!isOwner()) {
    alert("투표 마감은 방장만 할 수 있습니다.");
    return;
  }

  const candidates = getCandidates();
  if (candidates.length === 0) {
    alert("먼저 후보 장소를 등록해주세요.");
    return;
  }

  const maxVotes = Math.max(...candidates.map((candidate) => candidate.votes));
  const winners = candidates.filter((candidate) => candidate.votes === maxVotes);

  if (maxVotes === 0) {
    alert("아직 투표가 없습니다.");
    return;
  }

  if (winners.length === 1) {
    saveFinalPlace(winners[0]);
    alert(`${winners[0].name}이(가) 최종 약속장소로 결정되었습니다!`);
    return;
  }

  showTieLadder(winners);
};

const ensureFinishButton = () => {
  if (!isOwner() || loadFinalPlace()) return;
  const panel = document.querySelector(".candidate-panel");
  if (!panel || panel.querySelector(`#${FINISH_BUTTON_ID}`)) return;

  const button = document.createElement("button");
  button.id = FINISH_BUTTON_ID;
  button.type = "button";
  button.textContent = "🗳️ 투표 마감하고 최종 장소 정하기";
  button.addEventListener("click", finishVote);
  panel.appendChild(button);
};

const boot = () => {
  const finalPlace = loadFinalPlace();
  if (finalPlace) {
    renderFinalPlace(finalPlace);
    return;
  }
  ensureFinishButton();
};

const observer = new MutationObserver(() => boot());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("load", boot);
boot();
