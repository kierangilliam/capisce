// SAMPLE DATA. This example has no production, so these numbers are made up. They are worked out from each
// endpoint's name, so every run gives the same ones. A real source asks a tracing tool instead, for example
// Sentry or OpenTelemetry, and returns rows of the same shape.
const QUIET_ENDPOINTS = ["POST /sign-out"];

function number_from(text) {
  let number = 7;
  for (const letter of text) {
    number = (number * 31 + letter.charCodeAt(0)) % 100_003;
  }
  return number;
}

export default async function sample_timings({ ids }) {
  const rows = ids
    .filter((id) => !QUIET_ENDPOINTS.includes(id))
    .map((id) => {
      const seed = number_from(id);
      let p50_ms = 4 + (seed % 60);
      if (!id.startsWith("GET ")) {
        p50_ms = 20 + (seed % 240);
      }
      const p95_ms = p50_ms * (3 + (seed % 9));
      return { id, count: 40 + (seed % 5000), p50_ms, p95_ms };
    });
  return { window: "7d", source: "sample data", rows };
}
