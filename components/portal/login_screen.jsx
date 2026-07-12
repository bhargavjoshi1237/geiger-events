"use client";

import React from "react";

import AuthFlow from "./auth_flow";

// The /login route: the auth flow only. A `?setup=<token>` link (emailed) enters
// at the set-password step (token resolved server-side and passed in). On success
// AuthFlow redirects to /members; a signed-in member is redirected to /members by
// the server component before this renders.
export function LoginScreen({ setupToken = null }) {
  return <AuthFlow initialSetupToken={setupToken} />;
}

export default LoginScreen;
