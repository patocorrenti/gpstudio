import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectionStatus } from "@/features/connect/ConnectionStatus";

const links = [
  { to: "/", label: "Controller", end: true },
  { to: "/editor", label: "Editor" },
  { to: "/library", label: "Library" },
] as const;

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <p className="text-lg font-semibold tracking-tight">Patone</p>
          <ConnectionStatus />
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex gap-3 text-sm">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={"end" in link ? link.end : false}
                className={({ isActive }) =>
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
