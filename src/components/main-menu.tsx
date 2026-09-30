import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink, useMatch, useResolvedPath } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const menuItemClass =
  "h-8 w-full justify-start gap-2 px-2 font-normal";

function MenuLink({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: ReactNode;
}) {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: end ?? false });

  return (
    <NavigationMenuItem>
      <NavigationMenuLink
        asChild
        active={Boolean(match)}
        className={cn(
          navigationMenuTriggerStyle(),
          "rounded-[4px] bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground data-active:bg-muted data-active:text-foreground dark:hover:bg-muted/40 dark:data-active:bg-muted/40",
        )}
      >
        <NavLink to={to} end={end}>
          {children}
        </NavLink>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

function MobileNavLink({
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

function MobileThemeItem({ onToggle }: { onToggle: () => void }) {
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
        <Sun className="size-3 text-muted-foreground" />
      ) : (
        <Moon className="size-3 text-muted-foreground" />
      )}
      {mounted && isDark ? "Light mode" : "Dark mode"}
    </Button>
  );
}

export default function MainMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="md:hidden"
            aria-label="Menu"
            aria-expanded={open}
          >
            <Menu className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 gap-0.5 p-1">
          <MobileNavLink to="/" end onNavigate={() => setOpen(false)}>
            Pedal
          </MobileNavLink>
          <MobileNavLink to="/about" onNavigate={() => setOpen(false)}>
            About
          </MobileNavLink>
          <MobileThemeItem onToggle={() => setOpen(false)} />
        </PopoverContent>
      </Popover>

      <div className="hidden md:block">
        <NavigationMenu viewport={false}>
          <NavigationMenuList className="gap-1.5">
            <MenuLink to="/" end>
              Pedal
            </MenuLink>
            <MenuLink to="/log">Log</MenuLink>
            <MenuLink to="/about">About</MenuLink>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </>
  );
}
