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
          "bg-muted data-active:bg-muted dark:bg-muted/40 dark:data-active:bg-muted/40",
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
          Controller
        </MenuLink>
        <MenuLink to="/log">Log</MenuLink>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
