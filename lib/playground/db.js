// The playground's in-memory database: every seeded table, built lazily the
// first time the playground queries it and kept for the rest of the page
// session, so edits survive tab switches but a reload starts fresh.
//
// TEMPLATE: replace the example tables with the app's seed modules
// (`...formsSeed(), ...responsesSeed()`), keyed by the table names the data
// layer queries. Schema-qualified names ("forms.settings") win over bare ones
// when the code goes through `client.schema("forms")`.

import { createMemoryDb } from "./memory_client.js";
import { PLAYGROUND_PROJECT } from "./mode.js";
import { PEOPLE, PLAYGROUND_PERSON, STUDIO } from "./cast.js";

// Shaped like a Supabase auth user so the app's session parsing reads it
// unchanged.
export const PLAYGROUND_USER = {
  id: PLAYGROUND_PERSON.id,
  email: PLAYGROUND_PERSON.email,
  user_metadata: { full_name: PLAYGROUND_PERSON.name, avatar_url: PLAYGROUND_PERSON.avatar_url },
  app_metadata: {},
  aud: "authenticated",
  role: "authenticated",
};

export const getPlaygroundDb = createMemoryDb(() => ({
  projects: [
    {
      ...PLAYGROUND_PROJECT,
      created_by: PLAYGROUND_PERSON.id,
      created_at: new Date(Date.now() - 400 * 864e5).toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
  ],
  profiles: PEOPLE.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.name,
    avatar_url: p.avatar_url,
    title: p.title,
    organization: STUDIO.name,
  })),
}));
