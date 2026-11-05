// The desktop app's sign-in, org picker and browser handoff, so keep them out of search results.
export const metadata = { title: "Geiger Events", robots: { index: false, follow: false } };

export default function Layout({ children }) {
  return children;
}
