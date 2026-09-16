import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { to: "/", label: "Connect", end: true },
  { to: "/controller", label: "Controller" },
  { to: "/editor", label: "Editor" },
  { to: "/library", label: "Library" },
] as const;

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <p className="text-lg font-semibold tracking-tight">Valeton</p>
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
        </div>
        <ThemeToggle />
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
