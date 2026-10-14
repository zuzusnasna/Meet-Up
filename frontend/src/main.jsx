import { createRoot } from "react-dom/client";
import AppRouter from "./router/AppRouter";
import "./style.css";
import "./midpoint.css";
import "./vote-finish.css";
import "./transit-routes.css";

createRoot(document.getElementById("root")).render(<AppRouter />);
