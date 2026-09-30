import { createServerClient } from "@supabase/ssr";
import { OperationsError } from "../errors.js";

function bearerToken(request) {
  const header = request?.headers?.get?.("authorization");
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match) throw new OperationsError("unauthenticated", 401, "Sign in to continue.");
  return match[1];
}

async function defaultAuthClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new OperationsError("service_unavailable", 503, "Authentication is unavailable.");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) cookieStore.set(name, value, options);
      },
    },
  });
}

export async function resolveStaffPrincipal(request, { createAuthClient = defaultAuthClient } = {}) {
  const token = bearerToken(request);
  if (!token && !request?.headers?.get?.("cookie")) {
    throw new OperationsError("unauthenticated", 401, "Sign in to continue.");
  }
  const authClient = await createAuthClient(request);
  const { data, error } = token
    ? await authClient.auth.getUser(token)
    : await authClient.auth.getUser();
  if (error || !data?.user?.id) {
    throw new OperationsError("unauthenticated", 401, "Sign in to continue.");
  }
  return { kind: "staff", id: data.user.id };
}
