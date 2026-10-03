import { LogOut } from "lucide-react";
import { useAuthStore } from "../store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface UserMenuProps {
  /** Where the menu opens from — `top` in the sidebar, `bottom` in the top bar. */
  side?: "top" | "bottom";
  /** The sidebar shows the name beside the avatar; the mobile bar does not. */
  showName?: boolean;
}

/**
 * Avatar plus "Log out", shared by the sidebar and the mobile top bar
 * (ADR 0016) so the account lives in one component rather than two copies.
 */
export function UserMenu({ side = "top", showName = true }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-3 rounded-md text-left hover:bg-secondary ${
          showName ? "w-full px-2 py-2" : "p-1"
        }`}
        aria-label="Account"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.imageUrl ?? undefined} alt="" />
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        {showName && (
          <span className="truncate text-sm text-foreground">
            {user?.name ?? user?.email}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={side}>
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
