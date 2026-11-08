// team_auth.ts reads the browser sign-in return; a cold start needs "/" (null leaves no initial state, so the stack opens on sign-in), a warm start stays put.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (/^(?:[a-z][a-z0-9+.-]*:\/\/\/?|\/)?team-auth(?:[/?#]|$)/i.test(path)) return initial ? "/" : null;
  return path;
}
