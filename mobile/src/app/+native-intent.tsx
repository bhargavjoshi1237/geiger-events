// The browser sign-in return is read by team_auth.ts, so the router must not also try to open it as a route.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return /^(?:[a-z][a-z0-9+.-]*:\/\/\/?|\/)?team-auth(?:[/?#]|$)/i.test(path) ? null : path;
}
