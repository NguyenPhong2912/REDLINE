
  import { StrictMode } from "react";
  import { createRoot } from "react-dom/client";
  import { ClientProvider } from "@solana/react";
  import App from "./app/App";
  import { solanaClient } from "./app/solana/client";
  import "./styles/index.css";
  import "./styles/astral.css";
  import "./styles/layout.css";
import "./styles/hoyoverse.css";

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ClientProvider client={solanaClient}>
        <App />
      </ClientProvider>
    </StrictMode>,
  );
