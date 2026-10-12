import { useEffect, useMemo, useState } from "react";

const formatWon = (value) =>
  new Intl.NumberFormat("ko-KR").format(value || 0) + "원";

const makeExpense = (participants, index = 0) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: `정산 항목 ${index + 1}`,
  amount: "",
  payerId: participants[0]?.userId ? String(participants[0].userId) : "",
  participantIds: participants.map((participant) => String(participant.userId)),
});

function splitAmount(amount, count, index) {
  if (!count) return 0;
  return Math.floor(amount / count) + (index < amount % count ? 1 : 0);
}

export default function SettlementPanel({ roomId, participants }) {
  const storageKey = `meetupSettlementItems:${roomId}`;
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setExpenses(Array.isArray(parsed) ? parsed : []);
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error("정산 항목을 불러오지 못했습니다.", error);
      setExpenses([]);
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(expenses));
    } catch (error) {
      console.error("정산 항목을 저장하지 못했습니다.", error);
    }
  }, [storageKey, expenses, loaded]);

  const updateExpense = (id, updates) => {
    setExpenses((current) =>
      current.map((expense) => expense.id === id ? { ...expense, ...updates } : expense)
    );
  };

  const addExpense = () => {
    setExpenses((current) => [...current, makeExpense(participants, current.length)]);
  };

  const removeExpense = (id) => {
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  };

  const participantKeys = participants.map((participant) => String(participant.userId));
  const totalAmount = expenses.reduce(
    (sum, expense) => sum + Math.max(0, Number(expense.amount) || 0),
    0
  );

  const settlement = useMemo(() => {
    const totals = participants.map((participant) => ({
      id: String(participant.userId),
      name: participant.userName || "참여자",
      share: 0,
      paid: 0,
    }));

    expenses.forEach((expense) => {
      const amount = Math.max(0, Number(expense.amount) || 0);
      const included = (expense.participantIds || [])
        .map(String)
        .filter((id) => totals.some((person) => person.id === id));
      const payer = totals.find((person) => person.id === String(expense.payerId));
      if (payer) payer.paid += amount;
      included.forEach((id, index) => {
        const person = totals.find((entry) => entry.id === id);
        if (person) person.share += splitAmount(amount, included.length, index);
      });
    });

    return totals.map((person) => ({
      ...person,
      balance: person.paid - person.share,
    }));
  }, [participants, expenses]);

  const activeParticipantNames = (expense) =>
    participants
      .filter((participant) =>
        (expense.participantIds || []).map(String).includes(String(participant.userId))
      )
      .map((participant) => participant.userName || "참여자")
      .join(", ");

  return (
    <section className="settlement-page">
      <div className="settlement-heading">
        <div>
          <p className="settlement-eyebrow">MEET-UP · SPLIT THE BILL</p>
          <h2>모임 정산하기</h2>
          <p>1차, 2차뿐 아니라 원하는 만큼 항목을 추가하고 장소별로 정산할 수 있어요.</p>
        </div>
        <div className="settlement-total">
          <span>전체 지출 금액</span>
          <strong>{formatWon(totalAmount)}</strong>
          <small>{expenses.length}개 항목 · {participants.length}명 참여</small>
        </div>
      </div>

      <div className="settlement-section-heading">
        <div>
          <h3>정산 항목</h3>
          <p>장소나 메뉴를 적고, 결제한 사람과 해당 비용을 나눌 참여자를 선택하세요.</p>
        </div>
        <button type="button" className="settlement-add-button" onClick={addExpense}>
          <span>＋</span> 항목 추가
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="settlement-empty settlement-empty-large">
          <span className="settlement-empty-icon">＋</span>
          <strong>아직 정산 항목이 없어요</strong>
          <p>‘항목 추가’를 눌러 식당, 카페, 1차, 2차 등 지출 내역을 등록하세요.</p>
          <button type="button" className="settlement-add-button" onClick={addExpense}>
            첫 정산 항목 추가
          </button>
        </div>
      ) : (
        <div className="settlement-expense-list">
          {expenses.map((expense, index) => (
            <article className="settlement-expense-card" key={expense.id}>
              <div className="settlement-expense-card-heading">
                <span className="settlement-expense-number">{index + 1}</span>
                <span className="settlement-expense-label">지출 항목 {index + 1}</span>
                <button
                  type="button"
                  className="settlement-remove-button"
                  onClick={() => removeExpense(expense.id)}
                  aria-label={`${expense.title} 삭제`}
                >
                  삭제
                </button>
              </div>

              <div className="settlement-expense-fields">
                <label className="settlement-field settlement-field-title">
                  <span>장소 / 항목명</span>
                  <input
                    value={expense.title}
                    onChange={(event) => updateExpense(expense.id, { title: event.target.value })}
                    placeholder="예: 홍길동 고깃집, 1차 저녁, 카페"
                  />
                </label>
                <label className="settlement-field">
                  <span>총 결제 금액</span>
                  <span className="settlement-input-wrap">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={expense.amount}
                      onChange={(event) => updateExpense(expense.id, {
                        amount: event.target.value.replace(/[^0-9]/g, ""),
                      })}
                      placeholder="예: 85000"
                      aria-label={`${expense.title} 총 결제 금액`}
                    />
                    <span>원</span>
                  </span>
                </label>
                <label className="settlement-field">
                  <span>결제한 사람</span>
                  <select
                    value={String(expense.payerId || "")}
                    onChange={(event) => updateExpense(expense.id, { payerId: event.target.value })}
                    disabled={participants.length === 0}
                  >
                    {participants.length === 0 ? (
                      <option value="">참여자 없음</option>
                    ) : participants.map((participant) => (
                      <option key={participant.userId} value={String(participant.userId)}>
                        {participant.userName || "참여자"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="settlement-participant-picker">
                <div className="settlement-picker-heading">
                  <span>이 비용을 나눌 사람</span>
                  <span>{(expense.participantIds || []).length}명 선택</span>
                </div>
                {participants.length === 0 ? (
                  <p className="settlement-picker-empty">먼저 모임에 참여자가 있어야 해요.</p>
                ) : (
                  <div className="settlement-participant-options">
                    {participants.map((participant) => {
                      const id = String(participant.userId);
                      const checked = (expense.participantIds || []).map(String).includes(id);
                      return (
                        <label className={`settlement-participant-option${checked ? " selected" : ""}`} key={id}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const selected = new Set((expense.participantIds || []).map(String));
                              if (event.target.checked) selected.add(id);
                              else selected.delete(id);
                              updateExpense(expense.id, { participantIds: participantKeys.filter((key) => selected.has(key)) });
                            }}
                          />
                          <span className="settlement-option-check">{checked ? "✓" : ""}</span>
                          <span>{participant.userName || "참여자"}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="settlement-expense-share">
                  {formatWon(Math.max(0, Number(expense.amount) || 0))} ÷ {(expense.participantIds || []).length}명
                  {" = "}
                  <strong>
                    {formatWon((expense.participantIds || []).length
                      ? Math.floor(Math.max(0, Number(expense.amount) || 0) / expense.participantIds.length)
                      : 0)}
                  </strong>
                  <span> / 1인 기준</span>
                </p>
                <p className="settlement-expense-included">
                  정산 참여자: {activeParticipantNames(expense) || "선택된 참여자 없음"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="settlement-results">
        <div className="settlement-results-heading">
          <div>
            <h3>참여자별 최종 정산</h3>
            <p>각 항목에서 선택한 참여자와 실제 결제자를 기준으로 계산해요. 양수는 받을 금액, 음수는 내야 할 금액이에요.</p>
          </div>
          <button type="button" className="settlement-reset" onClick={() => {
            if (window.confirm("모든 정산 항목을 삭제할까요?")) setExpenses([]);
          }}>
            전체 초기화
          </button>
        </div>

        {participants.length === 0 ? (
          <div className="settlement-empty">정산할 참여자가 아직 없습니다.</div>
        ) : (
          <div className="settlement-table-wrap">
            <table className="settlement-table">
              <thead>
                <tr>
                  <th>참여자</th>
                  <th>총 결제</th>
                  <th>개인 부담</th>
                  <th>정산 결과</th>
                </tr>
              </thead>
              <tbody>
                {settlement.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <span className="settlement-person">
                        <span className="settlement-person-avatar">👤</span>
                        <strong>{person.name}</strong>
                      </span>
                    </td>
                    <td>{formatWon(person.paid)}</td>
                    <td>{formatWon(person.share)}</td>
                    <td className={`settlement-person-total ${person.balance >= 0 ? "settlement-receive" : "settlement-pay"}`}>
                      {person.balance > 0 ? `받을 ${formatWon(person.balance)}`
                        : person.balance < 0 ? `보낼 ${formatWon(Math.abs(person.balance))}`
                        : "정산 완료"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>합계</th>
                  <th>{formatWon(settlement.reduce((sum, person) => sum + person.paid, 0))}</th>
                  <th>{formatWon(settlement.reduce((sum, person) => sum + person.share, 0))}</th>
                  <th>{formatWon(totalAmount)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="settlement-storage-note">
        정산 내역은 이 브라우저의 해당 모임에 저장됩니다. 다른 참여자와 자동 공유되지는 않아요.
      </p>
    </section>
  );
}
