import { useEffect, useMemo, useState } from "react";

const emptyAmounts = { first: "", second: "" };

const formatWon = (value) =>
  new Intl.NumberFormat("ko-KR").format(value || 0) + "원";

function splitAmount(amount, count, index) {
  const base = Math.floor(amount / count);
  const remainder = amount % count;
  return base + (index < remainder ? 1 : 0);
}

export default function SettlementPanel({ roomId, participants }) {
  const storageKey = `meetupSettlement:${roomId}`;
  const [amounts, setAmounts] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? { ...emptyAmounts, ...JSON.parse(saved) } : emptyAmounts;
    } catch {
      return emptyAmounts;
    }
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setAmounts(saved ? { ...emptyAmounts, ...JSON.parse(saved) } : emptyAmounts);
    } catch (error) {
      console.error("정산 금액을 불러오지 못했습니다.", error);
      setAmounts(emptyAmounts);
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(amounts));
    } catch (error) {
      console.error("정산 금액을 저장하지 못했습니다.", error);
    }
  }, [storageKey, amounts, loaded]);

  const participantCount = participants.length;
  const firstAmount = Math.max(0, Number(amounts.first) || 0);
  const secondAmount = Math.max(0, Number(amounts.second) || 0);
  const totalAmount = firstAmount + secondAmount;

  const shares = useMemo(
    () =>
      participants.map((participant, index) => {
        const firstShare = participantCount
          ? splitAmount(firstAmount, participantCount, index)
          : 0;
        const secondShare = participantCount
          ? splitAmount(secondAmount, participantCount, index)
          : 0;

        return {
          id: participant.userId,
          name: participant.userName || "참여자",
          firstShare,
          secondShare,
          totalShare: firstShare + secondShare,
        };
      }),
    [participants, participantCount, firstAmount, secondAmount]
  );

  const updateAmount = (key, value) => {
    const digitsOnly = value.replace(/[^0-9]/g, "");
    setAmounts((current) => ({ ...current, [key]: digitsOnly }));
  };

  return (
    <section className="settlement-page">
      <div className="settlement-heading">
        <div>
          <p className="settlement-eyebrow">MEET-UP · SPLIT THE BILL</p>
          <h2>모임 정산하기</h2>
          <p>1차와 2차 금액을 입력하면 참여자별 부담 금액을 자동으로 계산해요.</p>
        </div>
        <div className="settlement-total">
          <span>전체 금액</span>
          <strong>{formatWon(totalAmount)}</strong>
          <small>{participantCount}명 기준</small>
        </div>
      </div>

      <div className="settlement-amount-grid">
        <label className="settlement-amount-card">
          <span className="settlement-round-icon">1</span>
          <span className="settlement-round-title">1차 정산</span>
          <span className="settlement-input-wrap">
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={amounts.first}
              onChange={(event) => updateAmount("first", event.target.value)}
              placeholder="예: 85000"
              aria-label="1차 총 금액"
            />
            <span>원</span>
          </span>
          <small>
            1인당 {formatWon(participantCount ? Math.floor(firstAmount / participantCount) : 0)}
          </small>
        </label>

        <label className="settlement-amount-card second">
          <span className="settlement-round-icon">2</span>
          <span className="settlement-round-title">2차 정산</span>
          <span className="settlement-input-wrap">
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={amounts.second}
              onChange={(event) => updateAmount("second", event.target.value)}
              placeholder="예: 42000"
              aria-label="2차 총 금액"
            />
            <span>원</span>
          </span>
          <small>
            1인당 {formatWon(participantCount ? Math.floor(secondAmount / participantCount) : 0)}
          </small>
        </label>
      </div>

      <div className="settlement-results">
        <div className="settlement-results-heading">
          <div>
            <h3>참여자별 정산 금액</h3>
            <p>나누어떨어지지 않는 금액은 앞쪽 참여자부터 1원씩 더해 정확히 맞춰요.</p>
          </div>
          <button
            type="button"
            className="settlement-reset"
            onClick={() => setAmounts(emptyAmounts)}
          >
            금액 초기화
          </button>
        </div>

        {participantCount === 0 ? (
          <div className="settlement-empty">정산할 참여자가 아직 없습니다.</div>
        ) : (
          <div className="settlement-table-wrap">
            <table className="settlement-table">
              <thead>
                <tr>
                  <th>참여자</th>
                  <th>1차 부담</th>
                  <th>2차 부담</th>
                  <th>총 부담 금액</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((share, index) => (
                  <tr key={share.id ?? index}>
                    <td>
                      <span className="settlement-person">
                        <span className="settlement-person-avatar">👤</span>
                        <strong>{share.name}</strong>
                      </span>
                    </td>
                    <td>{formatWon(share.firstShare)}</td>
                    <td>{formatWon(share.secondShare)}</td>
                    <td className="settlement-person-total">{formatWon(share.totalShare)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>합계</th>
                  <th>{formatWon(shares.reduce((sum, share) => sum + share.firstShare, 0))}</th>
                  <th>{formatWon(shares.reduce((sum, share) => sum + share.secondShare, 0))}</th>
                  <th>{formatWon(shares.reduce((sum, share) => sum + share.totalShare, 0))}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="settlement-storage-note">
        입력한 금액은 이 브라우저의 해당 모임에 저장됩니다.
      </p>
    </section>
  );
}
