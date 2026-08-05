import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  handler: null as
    | ((args: { next: (arg?: unknown) => unknown }) => Promise<unknown>)
    | null,
  request: null as Request | null,
  getClaims: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({
    server: (fn: (args: { next: (arg?: unknown) => unknown }) => Promise<unknown>) => {
      state.handler = fn;
      return { fn };
    },
  }),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => state.request,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getClaims: state.getClaims } }),
}));

process.env["SUPABASE_URL"] = "https://example.supabase.co";
process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test";

await import("./auth-middleware");

const next = vi.fn((arg?: unknown) => arg);

/** Runs the middleware and returns whatever it threw. */
async function run(headers?: Record<string, string>) {
  state.request = new Request("https://app.test/_serverFn/x", headers ? { headers } : undefined);
  try {
    const result = await state.handler!({ next });
    return { result, thrown: null as unknown };
  } catch (thrown) {
    return { result: null, thrown };
  }
}

async function expect401(headers: Record<string, string> | undefined, reason: string) {
  const { thrown } = await run(headers);
  expect(thrown).toBeInstanceOf(Response);
  const response = thrown as Response;
  expect(response.status).toBe(401);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  await expect(response.json()).resolves.toEqual({ error: "Unauthorized", reason });
}

const VALID_SHAPE = "aaa.bbb.ccc";

beforeEach(() => {
  next.mockClear();
  state.getClaims.mockReset();
});

describe("requireSupabaseAuth", () => {
  it("returns a JSON 401 when the authorization header is missing", async () => {
    await expect401(undefined, "No authorization header provided");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a JSON 401 for a non-Bearer scheme", async () => {
    await expect401({ authorization: "Basic abc123" }, "Only Bearer tokens are supported");
  });

  it("returns a JSON 401 for a Bearer header with no token", async () => {
    // \u00a0 survives header normalization but is stripped by trim().
    await expect401({ authorization: "Bearer \u00a0" }, "No token provided");
  });

  it("returns a JSON 401 for a malformed (non-JWT) token", async () => {
    await expect401({ authorization: "Bearer not-a-jwt" }, "Invalid token");
    expect(state.getClaims).not.toHaveBeenCalled();
  });

  it("returns a JSON 401 for an expired token rejected by the auth service", async () => {
    state.getClaims.mockResolvedValue({ data: null, error: { message: "jwt expired" } });
    await expect401({ authorization: `Bearer ${VALID_SHAPE}` }, "Invalid token");
    expect(state.getClaims).toHaveBeenCalledWith(VALID_SHAPE);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a JSON 401 when the token carries no subject", async () => {
    state.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });
    await expect401({ authorization: `Bearer ${VALID_SHAPE}` }, "No user ID found in token");
  });

  it("passes the authenticated context onward for a valid token", async () => {
    state.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    const { thrown } = await run({ authorization: `Bearer ${VALID_SHAPE}` });
    expect(thrown).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    const context = (next.mock.calls[0]![0] as { context: { userId: string } }).context;
    expect(context.userId).toBe("user-1");
  });
});
