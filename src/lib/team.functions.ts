import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TeamNameInput = z.object({ name: z.string().trim().min(2).max(60) });
const JoinInput = z.object({ inviteCode: z.string().trim().min(6).max(40) });
const MemberIdInput = z.object({ memberId: z.string().uuid() });
const ShareInput = z.object({ needId: z.string().uuid(), share: z.boolean() });

export type TeamSummary = {
  canTeam: boolean;
  team: {
    id: string;
    name: string;
    inviteCode: string;
    createdAt: string;
    isOwner: boolean;
  } | null;
  members: { id: string; userId: string; role: string; createdAt: string; isMe: boolean }[];
  teamBalance: number | null;
};

type MembershipRow = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  teams: {
    id: string;
    name: string;
    owner_user_id: string;
    invite_code: string;
    created_at: string;
  } | null;
};

/** Team workspace for the signed-in user (Business plan feature). */
export const getTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { loadEntitlements } = await import("@/lib/entitlements.server");
    const entitlements = await loadEntitlements(userId);

    const { data: membership } = await supabase
      .from("team_members")
      .select("id, user_id, role, created_at, teams(id, name, owner_user_id, invite_code, created_at)")
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership || !(membership as unknown as MembershipRow).teams) {
      return {
        canTeam: entitlements.teamFeatures,
        team: null,
        members: [],
        teamBalance: null,
      } satisfies TeamSummary;
    }

    const row = membership as unknown as MembershipRow;
    const team = row.teams!;
    const { data: roster, error } = await supabase
      .from("team_members")
      .select("id, user_id, role, created_at")
      .eq("team_id", team.id)
      .order("created_at");
    if (error) throw new Error(error.message);

    return {
      canTeam: true,
      team: {
        id: team.id,
        name: team.name,
        inviteCode: team.invite_code,
        createdAt: team.created_at,
        isOwner: team.owner_user_id === userId,
      },
      members: (roster ?? []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        createdAt: m.created_at,
        isMe: m.user_id === userId,
      })),
      teamBalance: entitlements.teamBalance,
    } satisfies TeamSummary;
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TeamNameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("create_team_with_pool", {
      p_user: context.userId,
      p_name: data.name,
    });
    if (error) {
      if (error.message.includes("TEAM_NOT_ALLOWED")) {
        throw new Error("Team workspaces are part of the Business plan.");
      }
      if (error.message.includes("ALREADY_IN_TEAM")) {
        throw new Error("You're already in a team.");
      }
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const joinTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => JoinInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("invite_code", data.inviteCode)
      .maybeSingle();
    if (!team) throw new Error("No team found with that invite code.");

    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: userId, role: "member" });
    if (error) {
      if (error.code === "23505") throw new Error("You're already in that team.");
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MemberIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: target } = await supabase
      .from("team_members")
      .select("id, user_id, role")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!target) throw new Error("That member is gone.");
    if (target.role === "owner") {
      throw new Error("Owners can't be removed — delete the team instead.");
    }
    const { error } = await supabase.from("team_members").delete().eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { left: target.user_id === userId };
  });

/** Share or unshare one of your own cases with your team. */
export const shareNeedToTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ShareInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: need } = await supabase
      .from("needs")
      .select("id, user_id")
      .eq("id", data.needId)
      .maybeSingle();
    if (!need || need.user_id !== userId) {
      throw new Error("You can only share your own cases.");
    }
    let teamId: string | null = null;
    if (data.share) {
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) throw new Error("Create or join a team first.");
      teamId = membership.team_id;
    }
    const { error } = await supabase.from("needs").update({ team_id: teamId }).eq("id", data.needId);
    if (error) throw new Error(error.message);
    return { shared: data.share };
  });
