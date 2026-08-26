export async function GET(request) {
  const params = new URL(request.url).searchParams.toString();
  const location = `geigerevents://membership-return${params ? `?${params}` : ""}`;
  return new Response(null, { status: 307, headers: { Location: location } });
}
