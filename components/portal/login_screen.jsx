"use client";

import React from "react";

import AuthFlow from "./auth_flow";

// The members portal /login route: the auth flow only. A `?setup=<token>` link (emailed) enters
// at the set-password step (token resolved server-side and passed in). Organisers never sign in
// here — the workspace inherits its session from geiger-dash.
export function LoginScreen({ setupToken = null }) {
  return <AuthFlow initialSetupToken={setupToken} />;
}

export default LoginScreen;
