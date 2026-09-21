import type { ReactNode } from "react";
import { NavLink, useMatch, useResolvedPath } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

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

export default function MainMenu() {
  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList className="gap-1.5">
        <MenuLink to="/" end>
          Pedal
        </MenuLink>
        <MenuLink to="/log">Log</MenuLink>
        <MenuLink to="/about">About</MenuLink>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
