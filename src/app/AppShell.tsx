import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectionStatus } from "@/features/connect/ConnectionStatus";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-sm text-foreground font-medium"
    : "text-sm text-muted-foreground hover:text-foreground";

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <p className="text-lg font-semibold tracking-tight">Patone</p>
          <ConnectionStatus />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <nav>
            <NavLink to="/" end className={navClass}>
              Controller
            </NavLink>
            <NavLink to="/log" className={navClass}>
              Log
            </NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col p-6">
        <Outlet />
      </main>
    </div>
  );
}
