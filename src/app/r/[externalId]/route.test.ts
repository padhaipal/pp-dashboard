import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const params = Promise.resolve({ externalId: "919999990001" });
const saved = process.env.WHATSAPP_BOT_NUMBER;
afterEach(() => {
  if (saved === undefined) delete process.env.WHATSAPP_BOT_NUMBER;
  else process.env.WHATSAPP_BOT_NUMBER = saved;
});

describe("/r/[externalId]", () => {
  it("redirects to the bot number from WHATSAPP_BOT_NUMBER with the referrer in the message", async () => {
    process.env.WHATSAPP_BOT_NUMBER = "910000000000";
    const res = await GET(new Request("http://x/r/919999990001"), { params });
    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location.startsWith("https://wa.me/910000000000?text=")).toBe(true);
    expect(decodeURIComponent(location)).toContain("919999990001");
  });

  it("fails loudly when the number is unset rather than falling back", async () => {
    delete process.env.WHATSAPP_BOT_NUMBER;
    const res = await GET(new Request("http://x/r/919999990001"), { params });
    expect(res.status).toBe(500);
  });
});
