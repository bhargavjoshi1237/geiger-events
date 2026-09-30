export const initialWorkspaceState = { eventId: null, loading: false, data: null,
  draft: null, dirty: false, error: null };

export function workspaceReducer(state, action) {
  if (action.type === "scope") return { ...initialWorkspaceState, eventId: action.eventId, loading: true };
  if (state.eventId !== action.eventId) return state;
  switch (action.type) {
    case "loading": return { ...state, loading: true, error: null };
    case "loaded": return { ...state, loading: false, data: action.data,
      draft: action.data.draft ?? [], dirty: false, error: null };
    case "draft": return { ...state, draft: action.draft, dirty: true, error: null };
    case "saved": return { ...state, loading: false, data: { ...state.data, ...action.data },
      draft: action.data.draft ?? state.draft, dirty: false, error: null };
    case "failed": return { ...state, loading: false, error: action.error };
    default: return state;
  }
}
