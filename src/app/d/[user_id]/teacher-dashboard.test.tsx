import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TeacherDashboard } from "./teacher-dashboard";
import { EMPTY_ROOT_TEXT, INCOMPLETE_TOOLTIP } from "./dashboard-types";
import { EMPTY_SCORES, PROFILE, PROFILE_SCHOOL, SCORES_SCHOOL, makeFetch } from "./test-fixtures";

describe("TeacherDashboard", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("empty root renders the mvp2 header + location title and the no-results message (no share bar, no profile header)", async () => {
    const { fn } = makeFetch({ scores: EMPTY_SCORES });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={["28"]} />);

    expect(await screen.findByText(EMPTY_ROOT_TEXT)).toBeDefined();
    // the h1 is the location path, not the user's name
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("India");
    expect(screen.queryByTestId("profile-header")).toBeNull();
    expect(screen.queryByTestId("share-link")).toBeNull();
    expect(screen.queryByRole("link", { name: /What is Lifteracy\?/ })).toBeNull();
    // header nav + language toggle + report button
    expect(screen.getByRole("link", { name: "Top" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Your Profile" })).toBeDefined();
    expect(screen.getByRole("button", { name: "EN" })).toBeDefined();
    expect(screen.getByRole("button", { name: "हिं" })).toBeDefined();
    // no numeric root card, no detail/performance/spotlight sections
    expect(screen.queryByTestId("root-kpis")).toBeNull();
    expect(screen.queryByTestId("rep-meta")).toBeNull();
    // up-a-level is disabled at the user's own level
    expect((screen.getByRole("button", { name: "Up a level" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders mvp2's headline cards (average metric + using count) and the report sections", async () => {
    const { fn } = makeFetch();
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);

    const kpis = await screen.findByTestId("root-kpis");
    expect(kpis.textContent).toContain("72%");
    expect(kpis.textContent).toContain("average NIPUN grade 3 proxy");
    expect(kpis.textContent).toContain("2 of 2");
    expect(kpis.textContent).toContain("states using Lifteracy");
    // no students-active / change / as-of tiles
    expect(kpis.textContent).not.toContain("students active");
    expect(kpis.textContent).not.toContain("as of");
    // section headings (the nav carries the same words as links)
    expect(screen.getByText("State Detail", { selector: "div" })).toBeDefined();
    expect(screen.getByText("State Performance", { selector: "div" })).toBeDefined();
    expect(screen.getByText("DGSE Spotlight", { selector: "div" })).toBeDefined();
    expect(screen.getByText("Your Profile", { selector: "div" })).toBeDefined();
    // the detail card shows the top state with mvp2's single "Latest {metric}" figure
    expect(screen.getByTestId("rep-meta").textContent).toContain("Latest NIPUN grade 3 proxy");
    // mvp2 has no latest-bars chart and no children table on the page
    expect(document.querySelector('svg[data-rep-chart="latest"]')).toBeNull();
    expect(screen.queryByTestId("children-table")).toBeNull();
    // footer carries the Terms link
    expect(screen.getByRole("link", { name: "Terms and Conditions" })).toBeDefined();
  });

  it("black (incomplete) states are not drillable and show the tooltip", async () => {
    const { fn, calls } = makeFetch();
    vi.stubGlobal("fetch", vi.fn(fn));
    const { container } = render(<TeacherDashboard profile={PROFILE} incompleteStates={["28"]} />);

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

    // a complete state IS drillable; the up button then becomes enabled
    const up = container.querySelector('path[data-code="09"]')!;
    expect(up.getAttribute("data-incomplete")).toBeNull();
    fireEvent.dblClick(up);
    await waitFor(() => expect(screen.getByTestId("location-title").textContent).toContain("Uttar Pradesh"));
    expect(calls.some((u) => u.includes("/geo-entities/g-09/scores"))).toBe(true);
    const upBtn = screen.getByRole("button", { name: "Up a level" }) as HTMLButtonElement;
    expect(upBtn.disabled).toBe(false);
    fireEvent.click(upBtn);
    expect(screen.getByTestId("location-title").textContent).toBe("India");
  });

  it("builds the CSV link from the current metric and range (range bar lives in the Performance card)", async () => {
    const { fn } = makeFetch();
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);

    const link = await screen.findByTestId("csv-link");
    expect(link.getAttribute("href")).toBe("/api/proxy/geo-entities/g-in/scores.csv?metric=nipun_g3&range=30");

    // the metric toggle is rendered twice (under the title and under Performance), like mvp2
    const toggles = screen.getAllByRole("button", { name: "MPL-B proxy" });
    expect(toggles.length).toBe(2);
    fireEvent.click(toggles[1]);
    // a metric change refetches; the Performance card (and its range bar) comes back with the new data
    fireEvent.click(await screen.findByRole("button", { name: "90 days" }));
    await waitFor(() => expect(screen.getByTestId("csv-link").getAttribute("href")).toBe("/api/proxy/geo-entities/g-in/scores.csv?metric=mpl_b&range=90"));
    expect(screen.getAllByRole("button", { name: "MPL-B proxy" })[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("school level: student cards fill the map card, Detail shows the pinned student, double-click opens the modal", async () => {
    const { fn } = makeFetch({ scoresById: { "g-sch": SCORES_SCHOOL } });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE_SCHOOL} incompleteStates={[]} />);

    const cards = await screen.findAllByTestId("student-card");
    expect(cards.length).toBe(2);
    expect(screen.queryByTestId("geo-map")).toBeNull();
    expect(screen.queryByTestId("student-table")).toBeNull();
    // ancestors are title-cased, the school name is left as-is
    expect(screen.getByTestId("location-title").textContent).toBe("India  -  Uttar Pradesh  -  JHS CHINHAT");
    // one headline card only at school level
    const kpis = screen.getByTestId("root-kpis");
    expect(kpis.textContent).toContain("50%");
    expect(kpis.textContent).not.toContain("using Lifteracy");
    expect(screen.getByText("Student Detail", { selector: "div" })).toBeDefined();
    expect(screen.getByText("Student Performance", { selector: "div" })).toBeDefined();
    expect(screen.getByText("Teacher Spotlight", { selector: "div" })).toBeDefined();
    expect(cards[0].textContent).toContain("Student 1");
    expect(cards[0].textContent).toContain("22 attempts");
    expect(cards[0].textContent).toContain("90%");
    expect(cards[1].textContent).toContain("—");
    // detail defaults to the first student; clicking the second pins it
    expect(screen.getByTestId("rep-meta").textContent).toContain("Student 1");
    fireEvent.click(cards[1]);
    expect(screen.getByTestId("rep-meta").textContent).toContain("Student 2");
    // double-click opens the student modal
    fireEvent.dblClick(cards[0]);
    expect(screen.getByRole("dialog").textContent).toContain("Student 1");
    // Generate report is enabled at school level
    expect((screen.getByRole("button", { name: /Generate report/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("switches the UI to Hindi and remembers the choice", async () => {
    const { fn } = makeFetch({ scores: EMPTY_SCORES });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);

    await screen.findByText(EMPTY_ROOT_TEXT);
    fireEvent.click(screen.getByRole("button", { name: "हिं" }));
    expect(screen.getByRole("link", { name: "ऊपर" })).toBeDefined();
    expect(screen.getByRole("link", { name: "आपकी प्रोफ़ाइल" })).toBeDefined();
    expect(screen.getByTestId("location-title").textContent).toBe("भारत");
    expect(window.localStorage.getItem("lifteracy-dashboard-lang")).toBe("hi");
    window.localStorage.removeItem("lifteracy-dashboard-lang");
  });
});
