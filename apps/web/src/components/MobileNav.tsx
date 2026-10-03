import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS, navLinkClass } from "./nav-items";
import { UserMenu } from "./UserMenu";

/**
 * Navigation below `md` (ADR 0016): a slim top bar whose menu button opens a
 * left drawer with the same destinations as the sidebar.
 *
 * A drawer rather than a bottom tab bar because the player already owns the
 * bottom edge; two stacked bands would spend vertical space on exactly the
 * screens with least of it.
 *
 * Built on Radix `Dialog`, already a dependency, so focus trapping, escape
 * handling and scroll locking come for free rather than being hand-rolled.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Open navigation"
        >
          <Menu className="h-6 w-6" />
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card"
            aria-describedby={undefined}
          >
            <div className="flex items-center justify-between px-4 py-4">
              <Dialog.Title className="text-lg font-bold">
                🎧 Spotifake
              </Dialog.Title>
              <Dialog.Close
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <nav className="flex flex-1 flex-col gap-1 px-3">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  // Navigating within an overlay does not unmount it, so the
                  // drawer has to close itself.
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => navLinkClass(isActive)}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <NavLink to="/" className="text-base font-bold">
        🎧 Spotifake
      </NavLink>

      <UserMenu side="bottom" showName={false} />
    </header>
  );
}
