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

const EXISTING = {
  id: "u1",
  external_id: "919876543210",
  name: "Asha",
  role: "education_official",
  role_title: "Teacher",
  staff_notes: null,
  geo_entity_id: "g1",
  geo_entity_name: "Govt Primary School",
  geo_entity_type: "school",
  deleted_at: null,
  link: "https://wa.me/1234567890?text=hi",
};

// Routes geo search to a fixed hit, the phone lookup to `lookup` (default:
// no existing user) and staff-create / PATCH users/:id to `create`.
function mockFetch(create: { status: number; body: unknown }, lookup: unknown[] = []) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/proxy/geo-entities/search")) return jsonResponse(200, [GEO]);
    if (url.startsWith("/api/proxy/users/lookup")) return jsonResponse(200, lookup);
    if (url === "/api/proxy/users/staff-create" && init?.method === "POST") {
      return jsonResponse(create.status, create.body);
    }
    if (url === "/api/proxy/users/u1" && init?.method === "PATCH") {
      return jsonResponse(create.status, create.body);
    }
    return jsonResponse(404, { message: `unmocked ${url}` });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function fillAndSubmit(beforeSubmit?: () => void) {
  render(<OnboardingConsole />);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Asha" } });
  fireEvent.change(screen.getByLabelText("WhatsApp number"), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByLabelText("Geo entity search"), { target: { value: "Govt" } });
  // Debounced 300 ms, then the mocked search result row appears.
  fireEvent.click(await screen.findByText(/Govt Primary School · school · S001 · Block A/));
  beforeSubmit?.();
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

  it("shows 'WhatsApp number required' when the number is left blank", async () => {
    mockFetch({ status: 201, body: {} });
    render(<OnboardingConsole />);
    fireEvent.blur(screen.getByLabelText("WhatsApp number"));
    expect(screen.getByText("WhatsApp number required")).toBeDefined();
    expect((screen.getByRole("button", { name: "Create user" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("OnboardingConsole update mode", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("switches to update when the number belongs to a staff user and PATCHes only filled fields", async () => {
    const fetchMock = mockFetch({ status: 200, body: { id: "u1" } }, [EXISTING]);
    render(<OnboardingConsole />);
    fireEvent.change(screen.getByLabelText("WhatsApp number"), { target: { value: "9876543210" } });

    // Debounced lookup → existing-user notice and relabelled button.
    expect(await screen.findByText(/Existing user: Asha · Teacher · Govt Primary School/)).toBeDefined();
    const button = screen.getByRole("button", { name: "Update user" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Prefers Hindi" } });
    fireEvent.click(button);

    expect(await screen.findByText("Updated. Send this link to Asha:")).toBeDefined();
    expect(screen.getByDisplayValue(EXISTING.link)).toBeDefined();

    const patchCall = fetchMock.mock.calls.find(([u, init]) => u === "/api/proxy/users/u1" && init?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall![1]!.body as string)).toEqual({ new_staff_notes: "Prefers Hindi" });
    expect(fetchMock.mock.calls.find(([u]) => u === "/api/proxy/users/staff-create")).toBeUndefined();
    expect((screen.getByLabelText("WhatsApp number") as HTMLInputElement).value).toBe("");
  });

  it("promotes a student: PATCH carries role plus the filled fields, and needs a geo entity", async () => {
    const student = { ...EXISTING, name: null, role: "student", role_title: null, geo_entity_id: null, geo_entity_name: null, geo_entity_type: null };
    const fetchMock = mockFetch({ status: 200, body: { id: "u1" } }, [student]);
    render(<OnboardingConsole />);
    fireEvent.change(screen.getByLabelText("WhatsApp number"), { target: { value: "9876543210" } });

    expect(await screen.findByText(/Existing learner: \(no name\) \(student\)/)).toBeDefined();
    const button = screen.getByRole("button", { name: "Promote to staff" }) as HTMLButtonElement;
    // No geo entity and no name yet → cannot submit.
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Asha" } });
    fireEvent.change(screen.getByLabelText("Geo entity search"), { target: { value: "Govt" } });
    fireEvent.click(await screen.findByText(/Govt Primary School · school · S001 · Block A/));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    expect(await screen.findByText("Promoted. Send this link to Asha:")).toBeDefined();
    const patchCall = fetchMock.mock.calls.find(([u, init]) => u === "/api/proxy/users/u1" && init?.method === "PATCH");
    expect(JSON.parse(patchCall![1]!.body as string)).toEqual({
      role: "education_official",
      name: "Asha",
      new_geo_entity_id: "g1",
      new_role_title: "Teacher",
    });
    expect(fetchMock.mock.calls.find(([u]) => u === "/api/proxy/users/staff-create")).toBeUndefined();
  });

  it("refuses dev/admin numbers", async () => {
    mockFetch({ status: 200, body: {} }, [{ ...EXISTING, role: "dev", name: "David" }]);
    render(<OnboardingConsole />);
    fireEvent.change(screen.getByLabelText("WhatsApp number"), { target: { value: "9876543210" } });

    expect(await screen.findByText(/belongs to a dev account \(David\) and cannot be managed here/)).toBeDefined();
    expect((screen.getByRole("button", { name: "Create user" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("re-checks the number on submit, so a missed lookup still updates instead of creating", async () => {
    // Lookup mocked empty until submit time: simulates the debounced lookup
    // never having run for this number.
    let armed = false;
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.startsWith("/api/proxy/geo-entities/search")) return jsonResponse(200, [GEO]);
      if (url.startsWith("/api/proxy/users/lookup")) return jsonResponse(200, armed ? [EXISTING] : []);
      if (url === "/api/proxy/users/u1" && init?.method === "PATCH") return jsonResponse(200, { id: "u1" });
      return jsonResponse(404, { message: `unmocked ${url}` });
    });
    vi.stubGlobal("fetch", fn);
    await fillAndSubmit(() => {
      armed = true;
    });
    expect(await screen.findByText("Updated. Send this link to Asha:")).toBeDefined();
    expect(fn.mock.calls.find(([u]) => u === "/api/proxy/users/staff-create")).toBeUndefined();
  });

  it("refuses to update a deactivated user and points up the hierarchy", async () => {
    mockFetch({ status: 200, body: {} }, [{ ...EXISTING, deleted_at: "2026-01-01T00:00:00Z" }]);
    render(<OnboardingConsole />);
    fireEvent.change(screen.getByLabelText("WhatsApp number"), { target: { value: "9876543210" } });

    expect(await screen.findByText(/deactivated account \(Asha\)/)).toBeDefined();
    expect(screen.getByText(/next level up the Lifteracy hierarchy/)).toBeDefined();
    expect((screen.getByRole("button", { name: "Create user" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
