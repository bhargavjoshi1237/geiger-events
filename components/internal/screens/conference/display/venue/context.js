"use client";

import { createContext, useContext } from "react";

// Everything a venue scene needs from the board: the live board texture, the
// raw board canvas (for re-layouts), resolved theme, event, sessions and toggles.
export const VenueContext = createContext(null);

export const useVenue = () => useContext(VenueContext);
