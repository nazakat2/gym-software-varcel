import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Configure API client to use JWT tokens from localStorage
setAuthTokenGetter(() => {
  return localStorage.getItem("gym_access_token");
});

createRoot(document.getElementById("root")!).render(<App />);
