import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./sidepanel.css";
import SidePanel from "./SidePanel.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
