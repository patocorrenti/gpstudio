import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const menuItemClass =
  "h-9 w-full justify-start gap-2 px-2 text-base font-normal";

function MenuNavLink({
  to,
  end,
  children,
  onNavigate,
}: {
  to: string;
  end?: boolean;
  children: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Button type="button" variant="ghost" className={menuItemClass} asChild>
      <NavLink
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(isActive && "bg-muted text-foreground")
        }
      >
        {children}
      </NavLink>
    </Button>
  );
}

function MenuThemeItem({ onToggle }: { onToggle: () => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme !== "light";

  return (
    <Button
      type="button"
      variant="ghost"
      className={menuItemClass}
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
        onToggle();
      }}
    >
      {mounted && isDark ? (
        <Sun className="size-4 text-muted-foreground" />
      ) : (
        <Moon className="size-4 text-muted-foreground" />
      )}
      {mounted && isDark ? "Light mode" : "Dark mode"}
    </Button>
  );
}

export default function MainMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Menu"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 gap-0.5 p-1">
        <MenuNavLink to="/" end onNavigate={() => setOpen(false)}>
          Pedal
        </MenuNavLink>
        <MenuNavLink to="/about" onNavigate={() => setOpen(false)}>
          About
        </MenuNavLink>
        <MenuThemeItem onToggle={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
