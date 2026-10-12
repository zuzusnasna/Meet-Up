const createRungs = (count, rows = 8) => {
  const rungs = [];
  for (let row = 0; row < rows; row += 1) {
    const used = new Set();
    const columns = Array.from({ length: Math.max(0, count - 1) }, (_, index) => index)
      .sort(() => Math.random() - 0.5);

    columns.forEach((column) => {
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

window.showTieLadder = (candidates, winnerIndex) => {
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
  const close = () => modal.remove();
  modal.querySelector(".vote-finish-close").addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  requestAnimationFrame(() => {
    modal.querySelector(".ladder-path")?.classList.add("running");
  });

  setTimeout(() => {
    modal.querySelector(".ladder-status").textContent = "사다리 게임 결과가 나왔습니다!";
    modal.querySelector(".ladder-result").innerHTML = `
      <strong>🎉 ${ladder.winner.name}</strong>
      <span>${ladder.winner.address}</span>
      <em>서버에서 결정된 최종 약속장소입니다.</em>
    `;
  }, 3600);
};
