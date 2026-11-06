// Signed-in workspace and on-site tools, so keep them out of search results.
export const metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }) {
  return children;
}
