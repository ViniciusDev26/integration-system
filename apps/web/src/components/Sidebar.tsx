import { NavLink } from "react-router-dom";
import { NAV_ITEMS, navLinkClass } from "./nav-items";
import { UserMenu } from "./UserMenu";

/**
 * Persistent left navigation (ADR 0013) — brand, primary navigation, account.
 *
 * Hidden below `md`, where the same destinations are reached through the
 * drawer instead (ADR 0016): at 240px wide this would take two thirds of a
 * phone screen before any content was drawn.
 */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="px-6 py-5">
        <NavLink to="/" className="text-lg font-bold">
          🎧 Spotifake
        </NavLink>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <UserMenu side="top" />
      </div>
    </aside>
  );
}
