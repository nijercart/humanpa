import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

/**
 * Attaches the Supabase bearer token to every server-function RPC.
 * More resilient than the generated attacher: if the session isn't hydrated
 * yet (or the access token just expired) it refreshes once before giving up.
 */
export const attachBearer = createMiddleware({ type: "function" }).client(async ({ next }) => {
  if (typeof window === "undefined") return next();

  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;

    if (!token) {
      const refreshed = await supabase.auth.refreshSession();
      token = refreshed.data.session?.access_token;
    }
  } catch {
    token = undefined;
  }

  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
