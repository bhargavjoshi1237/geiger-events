import * as SecureStore from "expo-secure-store";

import { api, API_BASE } from "@/lib/api";
import type { ApiResult } from "@/lib/api";
import type { Member } from "@/types/portal";

const TOKEN_KEY = "geiger.portal.session";

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (e) {
    console.warn("[auth] getStoredToken failed", e);
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) {
    console.warn("[auth] storeToken failed", e);
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (e) {
    console.warn("[auth] clearStoredToken failed", e);
  }
}

export function lookupEmail(
  email: string,
): Promise<ApiResult<{ exists: boolean; hasPassword: boolean }>> {
  return api("/api/portal/lookup", { method: "POST", body: { email } });
}

export function login(
  email: string,
  password: string,
): Promise<ApiResult<{ token: string }>> {
  return api("/api/portal/login", { method: "POST", body: { email, password } });
}

export function requestSetup(email: string): Promise<boolean> {
  return api("/api/portal/request-setup", {
    method: "POST",
    body: { email, origin: API_BASE, basePath: "" },
  }).then((r) => r.ok);
}

export function setPassword(
  token: string,
  password: string,
): Promise<ApiResult<{ token: string }>> {
  return api("/api/portal/set-password", { method: "POST", body: { token, password } });
}

export async function fetchMe(token: string): Promise<{ member: Member } | null> {
  const res = await api<{ member: Member }>("/api/portal/me", { token });
  return res.ok ? res.data : null;
}

export function logout(token: string): Promise<boolean> {
  return api("/api/portal/logout", { method: "POST", token }).then((r) => r.ok);
}

export function logoutAll(token: string): Promise<boolean> {
  return api("/api/portal/logout-all", { method: "POST", token }).then((r) => r.ok);
}
