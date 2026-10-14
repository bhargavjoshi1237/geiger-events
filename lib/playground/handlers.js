// Everything the playground swaps into the data layer while it is mounted (see
// ./mode.js and ./use_playground_mode.js).
//
// TEMPLATE: add stand-ins for any data-layer primitive that doesn't go through
// createClient() (upload helpers, signed-URL helpers, server-action wrappers),
// and the fetch routes for the app's own /api/* calls in ./api_routes.js.

import { createMemoryClient } from "./memory_client.js";
import { getPlaygroundDb, PLAYGROUND_USER } from "./db.js";

// One client for the whole session, so every createClient() call shares state.
let client = null;

function createPlaygroundClient() {
  client ??= createMemoryClient({
    getDb: getPlaygroundDb,
    user: PLAYGROUND_USER,
    fkTables: {
      // owner_id: "profiles",
    },
    childFks: {
      // "galleries.gallery_items": "gallery_id",
    },
    rpc: {
      // my_rpc: ({ db, args, user }) => ...,
    },
    hooks: {},
  });
  return client;
}

export const playgroundHandlers = {
  createClient: createPlaygroundClient,
};

// Routes for interceptFetch (see ./intercept_fetch.js); null when the app has
// no /api/* calls to fake.
export const playgroundRoutes = null;
