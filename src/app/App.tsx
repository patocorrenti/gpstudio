import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/app/AppShell";
import { DeviceSessionProvider } from "@/features/connect/DeviceSessionProvider";
import { ControllerPage } from "@/features/controller/ControllerPage";
import { EditorPage } from "@/features/editor/EditorPage";
import { LibraryPage } from "@/features/library/LibraryPage";
import { AboutPage } from "@/features/about/AboutPage";
import { LogPage } from "@/features/log/LogPage";

export function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="patone-theme"
    >
      <DeviceSessionProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<ControllerPage />} />
              <Route
                path="/controller"
                element={<Navigate to="/" replace />}
              />
              <Route path="/log" element={<LogPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/library" element={<LibraryPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </DeviceSessionProvider>
    </ThemeProvider>
  );
}
