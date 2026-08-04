import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link to={user ? "/needs" : "/"} className="flex items-center gap-2.5 text-foreground">
          <Logo className="h-6 w-6" />
          <span className="font-display text-xl leading-none">HumanOS</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
