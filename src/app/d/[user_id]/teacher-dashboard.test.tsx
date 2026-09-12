import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TeacherDashboard } from "./teacher-dashboard";
import { EMPTY_ROOT_TEXT, INCOMPLETE_TOOLTIP } from "./dashboard-types";
import { EMPTY_SCORES, PROFILE, makeFetch } from "./test-fixtures";

describe("TeacherDashboard", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("empty root renders the header, the share link and the no-results message", async () => {
    const { fn } = makeFetch({ scores: EMPTY_SCORES });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={["28"]} explainerUrl="https://example.com/explainer" />);

    expect(await screen.findByText(EMPTY_ROOT_TEXT)).toBeDefined();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Asha Verma");
    expect(screen.getByTestId("share-link").textContent).toBe("lifteracy.ai/d/u1");
    expect(screen.getByRole("link", { name: /What is Lifteracy\?/ }).getAttribute("href")).toBe("https://example.com/explainer");
    // no numeric root card
    expect(screen.queryByTestId("root-kpis")).toBeNull();
  });

  it("black (incomplete) states are not drillable and show the tooltip", async () => {
    const { fn, calls } = makeFetch();
    vi.stubGlobal("fetch", vi.fn(fn));
    const { container } = render(<TeacherDashboard profile={PROFILE} incompleteStates={["28"]} explainerUrl={null} />);

    const ap = await waitFor(() => {
      const p = container.querySelector('path[data-code="28"]');
      if (!p) throw new Error("state 28 not drawn yet");
      return p;
    });
    expect(ap.getAttribute("data-incomplete")).toBe("true");
    // fill lives on the sibling fill path (interaction path has fill="none")
    const fill = ap.previousElementSibling as SVGPathElement;
    expect(fill.getAttribute("fill")).toBe("#000000");

    fireEvent.click(ap);
    fireEvent.dblClick(ap);
    expect(screen.getByTestId("geo-map").getAttribute("data-level")).toBe("country");
    expect(screen.getByTestId("location-title").textContent).toBe("India");
    expect(calls.some((u) => u.includes("/geo-entities/g-28/"))).toBe(false);

    fireEvent.mouseEnter(ap);
    expect(screen.getByText(INCOMPLETE_TOOLTIP)).toBeDefined();

    // a complete state IS drillable
    const up = container.querySelector('path[data-code="09"]')!;
    expect(up.getAttribute("data-incomplete")).toBeNull();
    fireEvent.dblClick(up);
    await waitFor(() => expect(screen.getByTestId("location-title").textContent).toContain("Uttar Pradesh"));
    expect(calls.some((u) => u.includes("/geo-entities/g-09/scores"))).toBe(true);
  });

  it("builds the CSV link from the current metric and range", async () => {
    const { fn } = makeFetch();
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} explainerUrl={null} />);

    const link = await screen.findByTestId("csv-link");
    expect(link.getAttribute("href")).toBe("/api/proxy/geo-entities/g-in/scores.csv?metric=nipun_g3&range=30");

    fireEvent.click(screen.getByRole("button", { name: "MPL-B proxy" }));
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    expect(screen.getByTestId("csv-link").getAttribute("href")).toBe("/api/proxy/geo-entities/g-in/scores.csv?metric=mpl_b&range=90");
  });
});
