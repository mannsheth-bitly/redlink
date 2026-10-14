import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "@/App";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/shared/auth-provider";
import { RefreshProvider } from "@/components/shared/refresh-provider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <RefreshProvider>
          <AuthProvider>
            <App />
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </RefreshProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
