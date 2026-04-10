export function GET() {
  const body = [
    "Contact: mailto:team@usetraceforge.com",
    "Expires: 2027-04-10T00:00:00.000Z",
    "Preferred-Languages: en",
    "Canonical: https://usetraceforge.com/.well-known/security.txt",
    "Policy: https://usetraceforge.com/security"
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
