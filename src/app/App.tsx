import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/app/AppShell";
import { ControllerPage } from "@/features/controller/ControllerPage";
import { EditorPage } from "@/features/editor/EditorPage";
import { LibraryPage } from "@/features/library/LibraryPage";

export function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="valeton-theme"
    >
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<ControllerPage />} />
            <Route
              path="/controller"
              element={<Navigate to="/" replace />}
            />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/library" element={<LibraryPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
