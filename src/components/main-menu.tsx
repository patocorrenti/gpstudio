import { NavLink } from "react-router-dom";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-sm text-foreground font-medium"
    : "text-sm text-muted-foreground hover:text-foreground";

export default function MainMenu() {
  return (
    <nav>
      <NavLink to="/" end className={navClass}>
        Controller
      </NavLink>
      <NavLink to="/log" className={navClass}>
        Log
      </NavLink>
    </nav>
  );
}