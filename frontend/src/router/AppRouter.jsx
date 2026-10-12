import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import App from "../App";

function HomeRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const roomId = Number(localStorage.getItem("meetupRoomId"));
    if (roomId && window.location.pathname === "/") {
      navigate(`/room/${roomId}`, { replace: true });
    }
  }, [navigate]);

  return <App />;
}

function RoomRoute() {
  const { roomId } = useParams();

  useEffect(() => {
    const parsedRoomId = Number(roomId);
    if (Number.isFinite(parsedRoomId) && parsedRoomId > 0) {
      localStorage.setItem("meetupRoomId", String(parsedRoomId));
      localStorage.removeItem("pendingInviteRoomId");
    }
  }, [roomId]);

  return <App />;
}

function InviteRoute() {
  const { roomId } = useParams();

  useEffect(() => {
    const parsedRoomId = Number(roomId);
    if (Number.isFinite(parsedRoomId) && parsedRoomId > 0) {
      localStorage.setItem("pendingInviteRoomId", String(parsedRoomId));
      localStorage.removeItem("meetupRoomId");
    }
  }, [roomId]);

  return <App />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/room/:roomId" element={<RoomRoute />} />
        <Route path="/invite/:roomId" element={<InviteRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
