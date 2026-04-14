export async function GET() {
  const res = await fetch(`${process.env.PP_SKETCH_INTERNAL_URL}/api-json`);
  const spec = await res.json();
  return Response.json(spec);
}
