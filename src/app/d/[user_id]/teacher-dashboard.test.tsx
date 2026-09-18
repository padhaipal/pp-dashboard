import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TeacherDashboard } from "./teacher-dashboard";
import { EMPTY_ROOT_TEXT, INCOMPLETE_TOOLTIP } from "./dashboard-types";
import { CHILD_UP, EMPTY_SCORES, PROFILE, PROFILE_SCHOOL, SCORES, SCORES_CLASS, SCORES_SCHOOL, SCORES_UP, makeFetch } from "./test-fixtures";

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

  it("renders mvp2's headline cards (average metric + using count, both on the red/amber/green scale) and the report sections", async () => {
    const { fn } = makeFetch();
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);

    const kpis = await screen.findByTestId("root-kpis");
    expect(kpis.textContent).toContain("72%");
    expect(kpis.textContent).toContain("average NIPUN grade 3 proxy");
    expect(kpis.textContent).toContain("2 of 2");
    expect(kpis.textContent).toContain("states using Lifteracy");
    // 2 of 2 = 100 % → green; the figure carries the colour inline (0 of N would be red)
    const usingBig = screen.getByText("states using Lifteracy").previousElementSibling as HTMLElement;
    expect(usingBig.style.color).toBe("rgb(22, 163, 74)");
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
    // no street underlay at country level
    expect(screen.queryByTestId("tile-underlay")).toBeNull();

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

  it("survives a pan whose release lands before the queued move (no error box)", async () => {
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);
    const svg = (await screen.findByTestId("geo-map")).querySelector("svg")!;
    fireEvent.pointerDown(svg, { pointerType: "mouse", clientX: 10, clientY: 10 });
    fireEvent.pointerMove(svg, { pointerType: "mouse", clientX: 40, clientY: 25 });
    fireEvent.pointerLeave(svg);
    fireEvent.pointerMove(svg, { pointerType: "mouse", clientX: 60, clientY: 30 });
    await waitFor(() => expect(screen.queryByText(/Something went wrong/)).toBeNull());
    expect(screen.getByTestId("geo-map")).toBeTruthy();
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

  it("school → teacher cards; double-click → the class (student tiles, 'Student Performance' only); tile → the student modal", async () => {
    const { fn, calls } = makeFetch({ scoresById: { "g-sch": SCORES_SCHOOL, "t-1": SCORES_CLASS } });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE_SCHOOL} incompleteStates={[]} />);

    // school level: one card per teacher, mvp2 nouns
    const cards = await screen.findAllByTestId("teacher-card");
    expect(cards.length).toBe(1);
    expect(screen.queryByTestId("geo-map")).toBeNull();
    expect(screen.queryByTestId("student-table")).toBeNull();
    expect(cards[0].textContent).toContain("Asha");
    expect(cards[0].textContent).toContain("Teacher · 4 students");
    expect(cards[0].textContent).toContain("75%");
    expect(cards[0].textContent).toContain("+2.0% last 30 days");
    // teachers get their referral link right under the map card (officials never do — see the country test)
    const shareBar = screen.getByTestId("share-bar");
    expect(shareBar.previousElementSibling?.getAttribute("data-testid")).toBe("map-card");
    expect(screen.getByTestId("share-link").textContent).toBe("lifteracy.ai/d/u1");
    // the website's "See Lifteracy in Action" clip is embedded, with a quiet share row for it
    expect(screen.queryByRole("link", { name: /What is Lifteracy\?/ })).toBeNull();
    expect(screen.getByTestId("explainer-video").getAttribute("src")).toBe("https://framerusercontent.com/assets/UzlwOpPmZp3DVtJKOUr7hrlM8.mp4");
    expect(screen.getByTestId("video-share-link").getAttribute("href")).toBe("https://www.lifteracy.ai/#video");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeDefined();
    // ancestors are title-cased, the school name is left as-is
    expect(screen.getByTestId("location-title").textContent).toBe("India  -  Uttar Pradesh  -  JHS CHINHAT");
    // one headline card only at school level
    const kpis = screen.getByTestId("root-kpis");
    expect(kpis.textContent).toContain("75%");
    expect(kpis.textContent).not.toContain("using Lifteracy");
    expect(screen.getByText("Teacher Detail", { selector: "div" })).toBeDefined();
    expect(screen.getByText("Teacher Performance", { selector: "div" })).toBeDefined();
    expect(screen.getByText("Teacher Spotlight", { selector: "div" })).toBeDefined();
    expect(screen.getByTestId("rep-meta").textContent).toContain("Asha");
    expect(screen.getByTestId("rep-meta").textContent).toContain("Latest NIPUN grade 3 proxy");

    // double-click the teacher → the class view
    fireEvent.dblClick(cards[0]);
    const tiles = await screen.findAllByTestId("student-tile");
    expect(calls.some((u) => u.includes("/geo-entities/t-1/scores"))).toBe(true);
    expect(tiles.length).toBe(2);
    expect(screen.getByTestId("location-title").textContent).toBe("India  -  Uttar Pradesh  -  JHS CHINHAT  -  Asha");
    // full, uncensored names; a nameless student shows the label as a muted placeholder
    expect(tiles[0].textContent).toContain("Rani Devi");
    expect(tiles[0].textContent).not.toContain("Student 1");
    expect(tiles[0].textContent).toContain("90%");
    expect(tiles[0].textContent).toContain("▲ +5.0%");
    expect(tiles[1].textContent).toContain("Student 2");
    expect(tiles[1].textContent).toContain("—");
    // the teacher renames a student in place: click the name → input → Enter → PATCH users/:id/profile
    fireEvent.click(tiles[1].querySelector('[data-testid="student-name"]')!);
    const input = screen.getByTestId("student-name-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Mohan Kumar" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(tiles[1].textContent).toContain("Mohan Kumar"));
    expect(calls).toContain("PATCH /api/proxy/users/s-2/profile");
    expect(screen.queryByRole("dialog")).toBeNull(); // renaming never opens the modal
    // class view: Performance only — no Detail, no Spotlight (section or nav link)
    expect(screen.getByText("Student Performance", { selector: "div" })).toBeDefined();
    expect(screen.queryByText("Student Detail", { selector: "div" })).toBeNull();
    expect(screen.queryByText(/Spotlight/, { selector: "div" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Spotlight/ })).toBeNull();
    expect((screen.getByRole("button", { name: "Up a level" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /Generate report/ }) as HTMLButtonElement).disabled).toBe(false);

    // click a tile → the student's dashboard modal: title, chart toggles, one sentence per voice note with audio
    fireEvent.click(tiles[0]);
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByTestId("student-modal-title").textContent).toContain("Rani Devi");
    expect(screen.getByTestId("student-modal-title").textContent).toContain("· Student");
    // the name is editable in the modal header too
    expect(screen.getByTestId("student-modal-title").querySelector('[data-testid="student-name"]')).not.toBeNull();
    await waitFor(() => expect(screen.getAllByTestId("audio-button").length).toBe(1));
    expect(calls.some((u) => u.includes("/users/s-1/literacy-test-scores"))).toBe(true);
    expect(calls.some((u) => u.includes("/users/s-1/media"))).toBe(true);
    const sentences = screen.getByTestId("student-sentences").textContent ?? "";
    expect(sentences).toContain("the student said");
    expect(sentences).toContain("घर");
    expect(sentences).toContain("correct");
    expect(sentences).toContain("nothing (no recording)");
    expect(sentences).toContain("incorrect");
    // the modal has its own metric + range toggles
    expect(dialog.querySelectorAll('[aria-label="Metric"]').length).toBe(1);
    expect(dialog.querySelectorAll('[aria-label="Range"]').length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // up → back to the teacher cards
    fireEvent.click(screen.getByRole("button", { name: "Up a level" }));
    expect((await screen.findAllByTestId("teacher-card")).length).toBe(1);
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

  it("block level: private schools are diamonds, government schools dots, with a legend and tooltip hint", async () => {
    const block = { ...PROFILE, geo_entity: { id: "g-blk", type: "block" as const, code: "090101", name: "SADAR", has_boundary: false, lat: 26.85, lng: 80.95 } };
    const school = (id: string, code: string, name: string, lat: number, lng: number, management_group: "government" | "private") => ({
      ...CHILD_UP,
      id,
      type: "school" as const,
      code,
      name,
      has_boundary: false,
      lat,
      lng,
      management_group,
    });
    const scores = {
      ...SCORES,
      entity: block.geo_entity,
      child_type: "school" as const,
      children: [
        school("g-s1", "09010100101", "PS Govt", 26.86, 80.96, "government"),
        school("g-s2", "09010100102", "Little Stars", 26.84, 80.94, "private"),
        // listed first but unscored: must be painted BELOW the coloured dots
        { ...school("g-s0", "09010100100", "Empty School", 26.85, 80.95, "government"), using_lifteracy: false, pass_rate: null, n: 0 },
      ],
      most_improved: [],
    };
    const { fn } = makeFetch({ scoresById: { "g-blk": scores } });
    vi.stubGlobal("fetch", vi.fn(fn));
    const { container } = render(<TeacherDashboard profile={block} incompleteStates={[]} />);

    const priv = await waitFor(() => {
      const el = container.querySelector('rect[data-id="g-s2"]');
      if (!el) throw new Error("not drawn yet");
      return el;
    });
    expect(priv.getAttribute("data-management")).toBe("private");
    expect(container.querySelector('circle[data-id="g-s1"]')).not.toBeNull();
    expect(container.querySelector('rect[data-id="g-s1"]')).toBeNull();
    // grey dot first in document order, coloured dots after it (on top)
    const order = [...container.querySelectorAll("[data-id]")].map((el) => el.getAttribute("data-id"));
    expect(order).toContain("g-s0");
    expect(order.indexOf("g-s0")).toBeLessThan(order.indexOf("g-s1"));
    expect(order.indexOf("g-s0")).toBeLessThan(order.indexOf("g-s2"));
    // same colour scale for both (score colour, not a management colour)
    expect(priv.getAttribute("fill")).toBe(container.querySelector('circle[data-id="g-s1"]')!.getAttribute("fill"));
    const legend = screen.getByTestId("school-kind-legend").textContent ?? "";
    expect(legend).toContain("Government school");
    expect(legend).toContain("Private school");
    fireEvent.mouseEnter(priv);
    expect(screen.getByRole("tooltip").textContent).toContain("private school");
    // no border at block level, tiles underneath
    expect(screen.getByTestId("tile-underlay")).toBeDefined();
  });

  it("state level: a district whose seed-time has_boundary is stale (false, no lat/lng) still draws from its polygon file", async () => {
    const { fn } = makeFetch({ scoresById: { "g-09": SCORES_UP } });
    vi.stubGlobal("fetch", vi.fn(fn));
    const { container } = render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);
    const up = await waitFor(() => {
      const p = container.querySelector('path[data-code="09"]');
      if (!p) throw new Error("not drawn yet");
      return p;
    });
    fireEvent.dblClick(up);
    await waitFor(() => {
      if (!container.querySelector('path[data-code="0901"]')) throw new Error("district not drawn");
    });
    expect(screen.getByTestId("geo-map").getAttribute("data-level")).toBe("state");
    // no share bar for an official
    expect(screen.queryByTestId("share-bar")).toBeNull();
  });

  it("zoom in / out buttons scale the map around its centre (every map level)", async () => {
    const { fn } = makeFetch();
    vi.stubGlobal("fetch", vi.fn(fn));
    const { container } = render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);
    await waitFor(() => {
      if (!container.querySelector('path[data-code="09"]')) throw new Error("not drawn yet");
    });
    const scaleOf = () => Number(/scale\(([\d.]+)\)/.exec(container.querySelector('[data-testid="geo-map"] svg > g')!.getAttribute("transform")!)![1]);
    expect(scaleOf()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(scaleOf()).toBeCloseTo(1.4, 5);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(scaleOf()).toBeCloseTo(1 / 1.4, 5);
  });
});
