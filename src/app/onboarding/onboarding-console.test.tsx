import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OnboardingConsole } from "./onboarding-console";

const GEO = {
  id: "g1",
  type: "school",
  code: "S001",
  name: "Govt Primary School",
  status: "operational",
  parent_name: "Block A",
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// Routes geo search to a fixed hit and staff-create to the given response.
function mockFetch(create: { status: number; body: unknown }) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/proxy/geo-entities/search")) return jsonResponse(200, [GEO]);
    if (url === "/api/proxy/users/staff-create" && init?.method === "POST") {
      return jsonResponse(create.status, create.body);
    }
    return jsonResponse(404, { message: `unmocked ${url}` });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function fillAndSubmit() {
  render(<OnboardingConsole />);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Asha" } });
  fireEvent.change(screen.getByLabelText("WhatsApp number"), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByLabelText("Geo entity search"), { target: { value: "Govt" } });
  // Debounced 300 ms, then the mocked search result row appears.
  fireEvent.click(await screen.findByText(/Govt Primary School · school · S001 · Block A/));
  fireEvent.click(screen.getByRole("button", { name: "Create user" }));
}

describe("OnboardingConsole create tab", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the link on 201", async () => {
    const link = "https://wa.me/1234567890?text=hi";
    const fetchMock = mockFetch({
      status: 201,
      body: { user: { id: "u1", external_id: "919876543210", name: "Asha" }, link },
    });

    await fillAndSubmit();

    expect(await screen.findByText("Created. Send this link to Asha:")).toBeDefined();
    expect(screen.getByDisplayValue(link)).toBeDefined();

    const createCall = fetchMock.mock.calls.find(([u]) => u === "/api/proxy/users/staff-create");
    expect(createCall).toBeDefined();
    expect(JSON.parse(createCall![1]!.body as string)).toEqual({
      name: "Asha",
      external_id: "919876543210",
      geo_entity_id: "g1",
      role_title: "Teacher",
    });
    // Form reset after success.
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("");
  });

  it("renders the server message on 409", async () => {
    mockFetch({
      status: 409,
      body: { statusCode: 409, message: "phone already registered", error: "Conflict" },
    });

    await fillAndSubmit();

    expect(await screen.findByText("Not created — phone already registered")).toBeDefined();
  });
});
