// Bundled sample booths for the landing Floor Plan playground — lets the
// interactive expo map render fully placed on the public page (no session/DB
// there). Shape matches the normalized booth view model FloorPlanScreen reads:
// { id, module, name, status, config: { x, y, hall, size, exhibitor, price } }.
// x/y are percent-of-canvas positions; a couple are left unplaced (no x/y) so the
// tray isn't empty. Used only behind the explicit `demo` prop.

export const DEMO_BOOTHS = [
  { id: "demo-booth-1", module: "booth", name: "A1", status: "Occupied", coverUrl: "", createdBy: null, projectId: null, config: { x: 18, y: 22, hall: "Hall 1", size: "Premium", exhibitor: "Stripe", price: 4500, notes: "" } },
  { id: "demo-booth-2", module: "booth", name: "A2", status: "Occupied", coverUrl: "", createdBy: null, projectId: null, config: { x: 38, y: 20, hall: "Hall 1", size: "Premium", exhibitor: "Vercel", price: 4500, notes: "" } },
  { id: "demo-booth-3", module: "booth", name: "B1", status: "Reserved", coverUrl: "", createdBy: null, projectId: null, config: { x: 60, y: 26, hall: "Hall 1", size: "Large", exhibitor: "Linear", price: 3000, notes: "" } },
  { id: "demo-booth-4", module: "booth", name: "B2", status: "Available", coverUrl: "", createdBy: null, projectId: null, config: { x: 80, y: 22, hall: "Hall 1", size: "Standard", exhibitor: "", price: 1800, notes: "" } },
  { id: "demo-booth-5", module: "booth", name: "C1", status: "Occupied", coverUrl: "", createdBy: null, projectId: null, config: { x: 22, y: 56, hall: "Hall 2", size: "Large", exhibitor: "Supabase", price: 3800, notes: "" } },
  { id: "demo-booth-6", module: "booth", name: "C2", status: "Reserved", coverUrl: "", createdBy: null, projectId: null, config: { x: 45, y: 60, hall: "Hall 2", size: "Standard", exhibitor: "Figma", price: 3000, notes: "" } },
  { id: "demo-booth-7", module: "booth", name: "C3", status: "Available", coverUrl: "", createdBy: null, projectId: null, config: { x: 70, y: 55, hall: "Hall 2", size: "Standard", exhibitor: "", price: 1800, notes: "" } },
  { id: "demo-booth-8", module: "booth", name: "D1", status: "Available", coverUrl: "", createdBy: null, projectId: null, config: { hall: "Hall 3", size: "Standard", exhibitor: "", price: 1800, notes: "" } },
  { id: "demo-booth-9", module: "booth", name: "D2", status: "Reserved", coverUrl: "", createdBy: null, projectId: null, config: { hall: "Hall 3", size: "Large", exhibitor: "Notion", price: 3000, notes: "" } },
];

export default DEMO_BOOTHS;
