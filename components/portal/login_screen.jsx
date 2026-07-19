"use client";

import React from "react";

import AuthFlow from "./auth_flow";

// The /login route: the auth flow only. A `?setup=<token>` link (emailed) enters
// at the set-password step (token resolved server-side and passed in). `workspace`
// (from ?workspace=1) signals arrival from the internal workspace: the sign-in
// shows workspace copy and returns to /project on success instead of /members.
export function LoginScreen({ setupToken = null, workspace = false }) {
  return <AuthFlow initialSetupToken={setupToken} workspace={workspace} />;
}

export default LoginScreen;
