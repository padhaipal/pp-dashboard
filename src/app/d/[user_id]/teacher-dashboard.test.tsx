import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TeacherDashboard } from "./teacher-dashboard";
import { RepTrend } from "./report-card-modal";
import { MvpMinutesChart } from "./mvp-widgets";
import { EMPTY_ROOT_TEXT, INCOMPLETE_TOOLTIP } from "./dashboard-types";
import { CHILD_AP, CHILD_UP, EMPTY_SCORES, MEDIA_MASKED, PROFILE, PROFILE_BLOCK, PROFILE_SCHOOL, SCORES, SCORES_CLASS, SCORES_CLASS_MASKED, SCORES_SCHOOL, SCORES_UP, makeFetch } from "./test-fixtures";

const pressed = (name: string) => screen.getAllByRole("button", { name }).map((b) => b.getAttribute("aria-pressed"));
// a button of the headline Time window toggle (the trend has its own copy of the same toggle)
const winBtn = (name: string) => within(screen.getByTestId("time-window-toggle")).getByRole("button", { name });
const winPressed = (name: string) => [winBtn(name).getAttribute("aria-pressed")];
// The page opens on Time; tests about the test-score metrics pick one first.
const pickNipunG3 = async () => {
  fireEvent.click((await screen.findAllByRole("button", { name: "NIPUN grade 3 proxy" }))[0]);
  await waitFor(() => expect(screen.getByTestId("rep-meta").textContent).toContain("Latest NIPUN grade 3 proxy"));
};

// The home level is for ranking against peers: no headline figures until a
// drill. Tests that check the figures drill into UP first (answered with the
// same fixture).
const drillIntoUp = async () => {
  const up = await waitFor(() => {
    const el = document.querySelector('path[data-code="09"]');
    if (!el) throw new Error("not drawn yet");
    return el;
  });
  fireEvent.dblClick(up);
  await waitFor(() => expect(screen.getByTestId("location-title").textContent).toContain("Uttar Pradesh"));
};

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
    const { fn } = makeFetch({ scoresById: { "g-09": SCORES } });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);
    await pickNipunG3();
    // no headline figures at the home level
    await screen.findByTestId("map-card");
    expect(screen.queryByTestId("root-kpis")).toBeNull();
    await drillIntoUp();

    const kpis = await screen.findByTestId("root-kpis");
    expect(kpis.textContent).toContain("72%");
    // the figure is the share of scored students (in the test's age band) who passed, and says so
    expect(kpis.textContent).toContain("72%");
    expect(kpis.textContent).toContain("of 8 year old students pass the NIPUN grade 3 proxy");
    expect(kpis.textContent).not.toContain("average NIPUN");
    expect(kpis.textContent).toContain("states using Lifteracy");
    // a plain count ("2", not "2 of 2"), in black
    const usingBig = screen.getByText("states using Lifteracy").previousElementSibling as HTMLElement;
    expect(usingBig.textContent).toBe("2");
    expect(usingBig.style.color).toBe("rgb(24, 24, 27)");
    // one faint line per state on the trend, lit up by the shared hover
    expect(document.querySelectorAll('[data-testid="student-line"]')).toHaveLength(2);
    // most improved and top performing side by side, under the trend
    // plain headings: the ranking follows the selected metric
    expect(screen.getByTestId("most-improved").textContent).toContain("Most improved");
    expect(screen.getByTestId("most-improved").textContent).not.toContain("·");
    expect(screen.getByTestId("most-improved").textContent).toContain("+2.5%");
    const top = screen.getByTestId("top-performing");
    expect(top.textContent).toContain("Top performing");
    expect(top.textContent).not.toContain("·");
    // UP 72 % above AP 60 %, figures as whole percentages
    expect(top.querySelectorAll('[data-testid="rank-row"]').length).toBe(2);
    expect(top.querySelector('[data-testid="rank-row"]')?.getAttribute("data-id")).toBe("g-09");
    // the trend has its own Yesterday / 7 / 30 days / All time toggle, on 30 days
    expect(within(screen.getByTestId("trend-window-toggle")).getByRole("button", { name: "Last 30 days" }).getAttribute("aria-pressed")).toBe("true");
    expect(top.textContent).toContain("72%");
    expect(top.textContent).toContain("60%");
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

  it("a block official opens on their district — every block ranked, their own selected — with no level above; the title is not doubled", async () => {
    const own = { ...CHILD_UP, id: "g-0901-01", code: "090101", name: "KAKORI" };
    const { fn, calls } = makeFetch({
      scoresById: { "g-0901": { ...SCORES, entity: { id: "g-0901", type: "district", code: "0901", name: "LUCKNOW", has_boundary: true, lat: null, lng: null }, child_type: "block", children: [own, CHILD_AP], most_improved: [own] } },
    });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE_BLOCK} incompleteStates={[]} />);
    await waitFor(() => expect(calls.some((u) => u.startsWith("/api/proxy/geo-entities/g-0901/scores?"))).toBe(true));
    expect(calls.some((u) => u.includes("/geo-entities/g-0901-01/"))).toBe(false);
    await screen.findByTestId("map-card");
    expect(screen.queryByTestId("root-kpis")).toBeNull();
    expect(screen.getByTestId("location-title").textContent).toBe("Lucknow  -  Uttar Pradesh  -  India");
    // their own block is tagged "You" on its bar and outlined on the strip
    const ownBar = await screen.findByTestId("own-bar-tag");
    expect(ownBar.textContent).toBe("You");
    expect(ownBar.parentElement?.getAttribute("data-own")).toBe("1");
    expect((screen.getByRole("button", { name: "Up a level" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("bars: double-click drills into the area; the hover card sits above the map's legend; double-click on the map / tiles background goes up", async () => {
    const { fn } = makeFetch({ scoresById: { "g-09": SCORES_UP } });
    vi.stubGlobal("fetch", vi.fn(fn));
    const { container } = render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);
    await screen.findByTestId("bar-strip");
    const bar = container.querySelector('[data-testid="bar"][data-id="g-09"]')!;
    fireEvent.mouseEnter(bar);
    expect(screen.getByTestId("bar-card").className).toContain("z-40");
    fireEvent.dblClick(bar);
    await waitFor(() => expect(screen.getByTestId("location-title").textContent).toContain("Uttar Pradesh"));
    // double-click on the map background (not on an area) → back up to India
    fireEvent.dblClick(screen.getByTestId("map-svg"));
    await waitFor(() => expect(screen.getByTestId("location-title").textContent).toBe("India"));

    // school → class, then double-click the grey background of the tiles → back to the school
    cleanup();
    vi.stubGlobal("fetch", vi.fn(makeFetch({ scoresById: { "g-sch": SCORES_SCHOOL, "t-1": SCORES_CLASS } }).fn));
    render(<TeacherDashboard profile={PROFILE_SCHOOL} incompleteStates={[]} />);
    fireEvent.dblClick(await screen.findByTestId("teacher-card"));
    await screen.findAllByTestId("student-tile");
    // a double-click on a tile does not go up
    fireEvent.dblClick(screen.getAllByTestId("student-tile")[0]);
    expect(screen.queryAllByTestId("student-tile").length).toBeGreaterThan(0);
    fireEvent.dblClick(screen.getByTestId("student-tiles"));
    await waitFor(() => expect(screen.queryByTestId("teacher-card")).not.toBeNull());
  });

  it("builds the CSV link from the current metric and range (range bar lives in the Performance card)", async () => {
    const { fn } = makeFetch();
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);

    // opens on Time, so the link carries the window
    const link = await screen.findByTestId("csv-link");
    expect(link.getAttribute("href")).toBe("/api/proxy/geo-entities/g-in/scores.csv?metric=usage&range=30&window=all&viewer=u1");

    // the metric toggle is rendered twice (under the title and under Performance), like mvp2
    const toggles = screen.getAllByRole("button", { name: "MPL-B proxy" });
    expect(toggles.length).toBe(2);
    fireEvent.click(toggles[1]);
    // a metric change refetches; the Performance card (and its range bar) comes back with the new data
    fireEvent.click(await screen.findByRole("button", { name: "All time" }));
    await waitFor(() => expect(screen.getByTestId("csv-link").getAttribute("href")).toBe("/api/proxy/geo-entities/g-in/scores.csv?metric=mpl_b&range=all&viewer=u1"));
    expect(screen.getAllByRole("button", { name: "MPL-B proxy" })[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("a viewer who is not the students' teacher (e.g. the block official): masked names and phones, no renaming, recordings locked behind a sample clip; a peer teacher's phone is masked too", async () => {
    const { fn, calls } = makeFetch({ scoresById: { "g-sch": SCORES_SCHOOL, "t-1": SCORES_CLASS_MASKED }, media: MEDIA_MASKED });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE_SCHOOL} incompleteStates={[]} />);

    // every proxy call says who is looking
    const cards = await screen.findAllByTestId("teacher-card");
    expect(calls.filter((u) => u.startsWith("/api/proxy/")).every((u) => u.includes("viewer=u-sch"))).toBe(true);

    // the teacher's own modal (opened from the Detail card) shows her (masked) number
    fireEvent.click(screen.getByTestId("rep-meta"));
    const teacherDialog = await screen.findByRole("dialog");
    expect(within(teacherDialog).getByTestId("official-phone").textContent).toBe("9...2");
    fireEvent.click(within(teacherDialog).getByRole("button", { name: /Close/ }));

    fireEvent.dblClick(cards[0]);
    const tiles = await screen.findAllByTestId("student-tile");
    expect(tiles.length).toBe(2);
    // masked as pp-sketch sent them; the names are plain text, never a Rename control
    expect(tiles[0].textContent).toContain("R...i");
    expect(tiles[0].textContent).not.toContain("Rani Devi");
    expect(tiles[0].querySelector('[data-testid="tile-phone"]')?.textContent).toBe("9...1");
    expect(tiles[1].querySelector('[data-testid="tile-phone"]')?.textContent).toBe("9...2");
    expect(tiles[0].querySelector('[data-testid="student-name-masked"]')).not.toBeNull();
    expect(screen.queryAllByTestId("student-name")).toHaveLength(0);
    expect(screen.queryByText("Rename")).toBeNull();
    expect(tiles[1].textContent).toContain("~");

    // the student modal: masked title, no editing, the recording is a locked waveform with its length
    fireEvent.click(tiles[0]);
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByTestId("student-modal-title").textContent).toContain("R...i");
    expect(screen.getByTestId("student-modal-title").querySelector('[data-testid="student-name"]')).toBeNull();
    expect(screen.getByTestId("student-modal-phone").textContent).toBe("9...1");
    const locked = await within(dialog).findByTestId("masked-audio");
    expect(within(dialog).queryByTestId("audio-button")).toBeNull();
    expect(within(locked).getByTestId("masked-audio-duration").textContent).toBe("0:07");
    expect(locked.querySelectorAll("rect").length).toBe(28);
    expect(calls.some((u) => u.includes("/media-meta-data/m-1/audio"))).toBe(false);

    // pressing it explains and offers the stand-in clip, never the real audio
    fireEvent.click(locked);
    const sample = await screen.findByTestId("sample-audio-modal");
    expect(sample.textContent).toContain("This recording is private");
    expect((within(sample).getByTestId("sample-audio") as HTMLAudioElement).getAttribute("src")).toBe("/sample-child-response.wav");
    fireEvent.click(within(sample).getByRole("button", { name: /Close/ }));
    expect(screen.queryByTestId("sample-audio-modal")).toBeNull();
    expect(calls.some((u) => u.includes("/media-meta-data/m-1/audio"))).toBe(false);
  });

  it("school → teacher cards; double-click → the class (student tiles, 'Student Performance' only); tile → the student modal", async () => {
    const { fn, calls } = makeFetch({ scoresById: { "g-sch": SCORES_SCHOOL, "t-1": SCORES_CLASS } });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE_SCHOOL} incompleteStates={[]} />);
    await pickNipunG3();

    // school level: one card per teacher, mvp2 nouns
    const cards = await screen.findAllByTestId("teacher-card");
    expect(cards.length).toBe(1);
    expect(screen.queryByTestId("geo-map")).toBeNull();
    expect(screen.queryByTestId("student-table")).toBeNull();
    expect(cards[0].textContent).toContain("Asha");
    expect(cards[0].textContent).toContain("Teacher · 4 students");
    expect(cards[0].textContent).toContain("75%");
    expect(cards[0].textContent).toContain("+2.0% last 30 days");
    // teachers get their referral link right under the map card + bar strip (officials never do — see the country test)
    const shareBar = screen.getByTestId("share-bar");
    // the bar strip sits ABOVE the map card (2026-10)
    expect(shareBar.previousElementSibling?.getAttribute("data-testid")).toBe("map-card");
    expect(shareBar.previousElementSibling?.previousElementSibling?.getAttribute("data-testid")).toBe("bar-strip-wrap");
    // one bar per teacher under the map; hovering it marks the bar hot and shows the card
    const teacherBars = document.querySelectorAll('[data-testid="bar-strip"] [data-testid="bar"]');
    expect(teacherBars).toHaveLength(1);
    fireEvent.mouseEnter(teacherBars[0]);
    expect(teacherBars[0].getAttribute("data-hot")).toBe("1");
    expect(screen.getByTestId("bar-card").textContent).toContain("Rank");
    fireEvent.mouseLeave(screen.getByTestId("bar-strip"));
    expect(screen.getByTestId("share-link").textContent).toBe("lifteracy.ai/d/u1");
    // the website's "See Lifteracy in Action" clip is embedded, with a quiet share row for it
    expect(screen.queryByRole("link", { name: /What is Lifteracy\?/ })).toBeNull();
    expect(screen.getByTestId("explainer-video").getAttribute("src")).toBe("https://framerusercontent.com/assets/UzlwOpPmZp3DVtJKOUr7hrlM8.mp4");
    expect(screen.getByTestId("video-share-link").getAttribute("href")).toBe("https://www.lifteracy.ai/#video");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeDefined();
    // smallest area first; ancestors are title-cased, the school name is left as-is
    expect(screen.getByTestId("location-title").textContent).toBe("JHS CHINHAT  -  Uttar Pradesh  -  India");
    // only the first (smallest) segment is dark
    const segs = screen.getByTestId("location-title").querySelectorAll("span");
    expect(segs[0].className).toContain("text-zinc-900");
    expect(segs[1].className).toContain("text-zinc-400");
    // no headline figures at the home level; Tom (u-sch) has no card in this fixture, so no "You" tag
    expect(screen.queryByTestId("root-kpis")).toBeNull();
    expect(screen.queryByTestId("own-card-tag")).toBeNull();
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
    expect(screen.getByTestId("location-title").textContent).toBe("Asha  -  JHS CHINHAT  -  Uttar Pradesh  -  India");
    // full, uncensored names; a nameless student shows the label as a muted placeholder
    expect(tiles[0].textContent).toContain("Rani Devi");
    // …and the student's number under the name, named or not
    expect(tiles[0].querySelector('[data-testid="tile-phone"]')?.textContent).toBe("919999990011");
    expect(tiles[1].querySelector('[data-testid="tile-phone"]')?.textContent).toBe("919999990022");
    expect(tiles[0].textContent).not.toContain("Student 1");
    expect(tiles[0].textContent).toContain("90%");
    expect(tiles[0].textContent).toContain("▲ +5.0%");
    // an unnamed student shows "~" (never the API's "Student N"), with a visible Rename pill
    expect(tiles[1].textContent).not.toContain("Student 2");
    expect(tiles[1].textContent).toContain("~");
    expect(tiles[1].textContent).toContain("Rename");
    // one bar per student in the class view, valued by score
    expect(document.querySelectorAll('[data-testid="bar-strip"] [data-testid="bar"]')).toHaveLength(2);
    // the trend draws one faint line per student with data; hovering a tile lights its line
    expect(document.querySelectorAll('[data-testid="student-line"]')).toHaveLength(1);
    fireEvent.mouseEnter(tiles[0]);
    expect(document.querySelector('[data-testid="student-line"][data-student-id="s-1"]')?.getAttribute("data-hot")).toBe("1");
    fireEvent.mouseLeave(tiles[0]);
    expect(document.querySelector('[data-testid="student-line"][data-student-id="s-1"]')?.getAttribute("data-hot")).toBeNull();
    expect(tiles[1].textContent).toContain("—");
    // the teacher renames a student in place: click the name → input → Enter → PATCH users/:id/profile
    fireEvent.click(tiles[1].querySelector('[data-testid="student-name"]')!);
    const input = screen.getByTestId("student-name-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Mohan Kumar" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(tiles[1].textContent).toContain("Mohan Kumar"));
    expect(calls).toContain("PATCH /api/proxy/users/s-2/profile?viewer=u-sch");
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
    expect(screen.getByTestId("student-modal-phone").textContent).toBe("919999990011");
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
    // a flow tap is one sentence too: the question, the option chosen, the correct one — and no audio button
    const taps = screen.getAllByTestId("tap-sentence");
    expect(taps.length).toBe(1);
    expect(taps[0].textContent).toContain("the student was asked “कमल कहाँ गया?” and chose “बाज़ार” and the correct answer was “स्कूल” and so was marked as incorrect.");
    expect(taps[0].querySelector('[data-testid="audio-button"]')).toBeNull();
    // a tap that was not awaited and an onboarding voice note are never listed (the single audio button above is m-1's)
    expect(sentences).not.toContain("पुराना सवाल");
    expect(screen.getByTestId("student-sentences").children.length).toBe(3);
    // the modal opens on the letter-score chart (no range: it is per interaction), with its own picker
    expect(dialog.querySelectorAll('[aria-label="Metric"]').length).toBe(1);
    const modalButton = (name: string) => Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === name)!;
    expect(modalButton("Letter scores").getAttribute("aria-pressed")).toBe("true");
    expect(calls.some((u) => u.includes("/users/s-1/scores"))).toBe(true);
    expect(calls.some((u) => u.includes("/scores/letter-bins?users=s-1"))).toBe(true);
    await waitFor(() => expect(dialog.textContent).toContain("No scores recorded"));
    expect(dialog.querySelectorAll('[aria-label="Range"]').length).toBe(0);
    // picking a test metric brings the range toggle (30 days / All time)
    fireEvent.click(modalButton("NIPUN grade 3 proxy"));
    expect(dialog.querySelectorAll('[aria-label="Range"]').length).toBe(1);
    expect(modalButton("All time")).toBeDefined();
    // …and narrows the interaction list to the answers that counted toward
    // that test (counted_message_ids): the tap m-3 only, with a note
    const sentencesOf = () => screen.getByTestId("student-sentences");
    expect(screen.getByTestId("test-interactions-note").textContent).toBe("The answers behind this student's current and previous NIPUN grade 3 proxy score.");
    expect(sentencesOf().querySelectorAll('[data-testid="tap-sentence"]').length).toBe(1);
    expect(sentencesOf().querySelectorAll('[data-testid="audio-button"]').length).toBe(0);
    expect(sentencesOf().textContent).not.toContain("the student said");
    // the student's pass line sits at the NIPUN mark (75), not the area target (80)
    const passLine = dialog.querySelector('[data-testid="student-pass-mark"]')!;
    expect(Number(passLine.getAttribute("y1"))).toBeCloseTo(14 + 176 - 0.75 * 176, 1);
    // MPL-B: one answer so far, twenty needed → listed with the explanation
    fireEvent.click(modalButton("MPL-B proxy"));
    expect(screen.getByTestId("test-interactions-note").textContent).toBe("These answers count toward MPL-B proxy, but at least 20 are needed before a score can be calculated.");
    expect(sentencesOf().querySelectorAll('[data-testid="tap-sentence"]').length).toBe(1);
    // NIPUN grade 2: nothing answered → blank list with the explanation
    fireEvent.click(modalButton("NIPUN grade 2 proxy"));
    expect(screen.getByTestId("test-interactions-note").textContent).toBe("No questions counting toward NIPUN grade 2 proxy answered yet.");
    expect(sentencesOf().children.length).toBe(1);
    expect(sentencesOf().textContent).not.toContain("No voice notes yet.");
    // Time and the letter chart list everything again, without a note
    fireEvent.click(modalButton("Time"));
    expect(screen.queryByTestId("test-interactions-note")).toBeNull();
    expect(sentencesOf().children.length).toBe(3);
    fireEvent.click(modalButton("Letter scores"));
    expect(screen.queryByTestId("test-interactions-note")).toBeNull();
    expect(sentencesOf().children.length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // up → back to the teacher cards
    fireEvent.click(screen.getByRole("button", { name: "Up a level" }));
    expect((await screen.findAllByTestId("teacher-card")).length).toBe(1);
  });

  it("trend axis follows the metric: minutes without a target for usage, 80% target only for NIPUN", () => {
    const pts = [
      { date: "2026-09-17", pass_rate: 25, n: 4, mean: 12.5 },
      { date: "2026-09-18", pass_rate: 50, n: 4, mean: 41 },
    ];
    const { container, rerender } = render(<RepTrend series={pts} metric="usage" label="Minutes per student" />);
    expect(container.textContent).not.toContain("80% NIPUN target");
    expect(container.textContent).toContain("Minutes per student");
    // axis grows to the next multiple of 10 above the data (41 → 50)
    expect(container.textContent).toContain("50");
    // usage rows are dated the morning after the activity: labels show the activity day
    expect(container.textContent).toContain("16 Sept");
    expect(container.textContent).toContain("17 Sept");
    expect(container.textContent).not.toContain("18 Sept");
    // no pass mark on a minutes axis
    expect(container.querySelector('[data-testid="pass-mark"]')).toBeNull();
    expect(container.textContent).not.toContain("pass mark");
    // MPL-B: a dotted 50 % pass mark (what "% of students pass" counts)
    rerender(<RepTrend series={pts} metric="mpl_b" label="MPL-B proxy" />);
    expect(container.textContent).toContain("50% pass mark");
    expect(container.textContent).not.toContain("NIPUN target");
    let mark = container.querySelector('[data-testid="pass-mark"]')!;
    // desktop geometry: mT 12, ih 234 → y(50) = 129
    expect(Number(mark.getAttribute("y1"))).toBeCloseTo(129, 0);
    // NIPUN: the pass mark is 75 (three of four right) — one line, no separate target
    rerender(<RepTrend series={pts} metric="nipun_g3" label="NIPUN g3 proxy" />);
    expect(container.textContent).toContain("75% pass mark");
    expect(container.textContent).not.toContain("50% pass mark");
    expect(container.textContent).not.toContain("NIPUN target");
    mark = container.querySelector('[data-testid="pass-mark"]')!;
    expect(Number(mark.getAttribute("y1"))).toBeCloseTo(70.5, 0);
    // the response's own pass mark wins over the default
    rerender(<RepTrend series={pts} metric="nipun_g2" passMark={80} label="NIPUN g2 proxy" />);
    expect(container.textContent).toContain("80% pass mark");
  });

  it("trend average line plots the metric mean, not the pass rate", () => {
    // pass rate 100 but mean score 50 → the Average label sits at the 50 line
    const pts = [{ date: "2026-09-18", pass_rate: 100, n: 2, mean: 50 }];
    const { container } = render(<RepTrend series={pts} metric="nipun_g3" label="NIPUN g3 proxy" />);
    const avg = Array.from(container.querySelectorAll("text")).find((el) => el.textContent === "Average")!;
    // desktop geometry: mT 12, ih 234 → y(50) = 129, label 7 above
    expect(Number(avg.getAttribute("y"))).toBeCloseTo(122, 0);
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
    // the metric toggle follows the language too
    expect(screen.getAllByRole("button", { name: "निपुण कक्षा 3 प्रॉक्सी" }).length).toBeGreaterThan(0);
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
    const order = [...container.querySelectorAll('[data-testid="geo-map"] [data-id]')].map((el) => el.getAttribute("data-id"));
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

describe("TeacherDashboard — Time metric", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("'Time' reveals the window toggle (default: all time) and shows totals only, coloured by the per-day average; no change arrows; most improved = rise in minutes", async () => {
    const { fn, calls } = makeFetch({ timeById: { "g-in": "geo", "g-09": "geo" }, scoresById: { "g-09": SCORES } });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);

    // the usage metric is called "Time", and it is what the page opens on (fresh load / refresh)
    await screen.findByTestId("map-card");
    await drillIntoUp();
    expect(screen.queryByRole("button", { name: "Daily usage (5+ min)" })).toBeNull();
    expect(pressed("Time")).toEqual(["true", "true"]);
    expect(screen.getAllByTestId("time-window-toggle")).toHaveLength(1);
    // its window toggle is hidden for other metrics
    fireEvent.click(screen.getAllByRole("button", { name: "NIPUN grade 3 proxy" })[0]);
    await waitFor(() => expect(screen.queryByTestId("time-window-toggle")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("most-improved")).toBeDefined());

    fireEvent.click(screen.getAllByRole("button", { name: "Time" })[0]);
    // ONE window toggle, under the title (the Performance card keeps only the trend's own range), on "All time"
    await waitFor(() => expect(screen.getAllByTestId("time-window-toggle")).toHaveLength(1));
    expect(within(screen.getByTestId("time-window-toggle")).getByRole("button", { name: "All time" }).getAttribute("aria-pressed")).toBe("true");
    expect(winPressed("Last seven days")).toEqual(["false"]);
    expect(winPressed("Yesterday")).toEqual(["false"]);
    await waitFor(() => expect(calls).toContain("/api/proxy/geo-entities/g-in/scores?metric=usage&range=30&window=all&viewer=u1"));
    await waitFor(() => expect(screen.getByTestId("root-kpis").textContent).toContain("2.5 hours"));

    // Last seven days: refetch — the previous figures stay on screen meanwhile (no blank / loading line)
    fireEvent.click(winBtn("Last seven days"));
    expect(winPressed("Last seven days")).toEqual(["true"]);
    expect(screen.getByTestId("root-kpis").textContent).toContain("2.5 hours");
    expect(screen.queryByText("Loading your dashboard…")).toBeNull();
    expect(document.querySelector('#rep-perf [data-testid="time-window-toggle"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /week/i })).toBeNull();
    await waitFor(() => expect(calls).toContain("/api/proxy/geo-entities/g-09/scores?metric=usage&range=30&window=7d&viewer=u1"));
    expect(calls).toContain("/api/proxy/geo-entities/g-09/spotlight?metric=usage&range=30&window=7d&viewer=u1");

    // headline: the total per student only (no minutes per day), coloured by the per-day average (5.4 → green)
    await waitFor(() => expect(screen.getByTestId("root-kpis").textContent).toContain("38 min"));
    const kpis = screen.getByTestId("root-kpis");
    expect(kpis.textContent).not.toContain("per day");
    expect(kpis.textContent).toContain("total time · last seven days");
    expect(kpis.textContent).not.toContain("72%");
    expect(screen.queryByTestId("kpi-per-day")).toBeNull();
    // 38 min per student in seven days clears the 35-minute mark → green
    expect((screen.getByText("total time · last seven days").previousElementSibling as HTMLElement).style.color).toBe("rgb(22, 163, 74)");

    // detail card: the top state's total, no per-day figure, no trend arrow
    const meta = screen.getByTestId("rep-meta");
    expect(meta.textContent).toContain("49 min");
    expect(meta.textContent).not.toContain("per day");
    expect(meta.textContent).toContain("Time · last seven days · per student");
    expect(meta.querySelector('[data-testid="mvp-trend"]')).toBeNull();

    // most improved (minutes vs the previous 7 days) and top performing (minutes) side by side; both spotlight cards
    expect(screen.getByTestId("most-improved").textContent).toContain("Most improved");
    expect(screen.getByTestId("most-improved").textContent).toContain("+7.0 min");
    expect(screen.getByTestId("top-performing").textContent).toContain("Top performing");
    expect(screen.getByTestId("top-performing").textContent).toContain("49 min");
    // the improved card is there in Time mode too (empty in this fixture: nobody qualifies yet)
    expect(screen.getByTestId("spotlight-improved").getAttribute("data-empty")).toBe("1");
    expect(screen.getByTestId("spotlight-top").textContent).toContain("49 min");
    expect(screen.getByTestId("spotlight-top").textContent).not.toContain("per day");

    // map: areas coloured by minutes per day (7 → green, 2 → amber), legend in minutes
    const map = screen.getByTestId("geo-map");
    // legend marks fit the window (last seven days: 35 / 10 min)
    expect(map.textContent).toContain("35 min+");
    expect(map.textContent).toContain("10 min – 35 min");
    expect(map.textContent).toContain("under 10 min");
    expect(map.textContent).not.toContain("≥80");

    // bars: total minutes
    // the strip has no caption text (2026-10)
    expect(screen.getByTestId("bar-strip").textContent).not.toContain("click a bar");

    // the CSV export follows the window
    expect(screen.getByTestId("csv-link").getAttribute("href")).toBe("/api/proxy/geo-entities/g-09/scores.csv?metric=usage&range=30&window=7d&viewer=u1");

    // Yesterday: refetch, new figures (4 min per day → amber)
    fireEvent.click(winBtn("Yesterday"));
    await waitFor(() => expect(calls).toContain("/api/proxy/geo-entities/g-09/scores?metric=usage&range=30&window=yesterday&viewer=u1"));
    await waitFor(() => expect(screen.getByTestId("root-kpis").textContent).toContain("total time · yesterday"));
    expect(screen.getByTestId("root-kpis").textContent).toContain("4 min");
    // 4 minutes yesterday: some time, under the 5-minute mark → amber
    expect((screen.getByText("total time · yesterday").previousElementSibling as HTMLElement).style.color).toBe("rgb(245, 158, 11)");
    expect(winPressed("Yesterday")).toEqual(["true"]);

    // All time: totals of 120 minutes and more are shown in hours, the average stays in minutes
    fireEvent.click(within(screen.getAllByTestId("time-window-toggle")[0]).getByRole("button", { name: "All time" }));
    await waitFor(() => expect(screen.getByTestId("root-kpis").textContent).toContain("2.5 hours"));
    expect(screen.getByTestId("root-kpis").textContent).not.toContain("per day");
    expect(screen.getByTestId("rep-meta").textContent).toContain("25 hours");

    // leaving Time hides the window toggle and brings the pass-rate view back
    fireEvent.click(screen.getAllByRole("button", { name: "NIPUN grade 3 proxy" })[0]);
    await waitFor(() => expect(screen.queryByTestId("time-window-toggle")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("root-kpis").textContent).toContain("72%"));
    expect(screen.getByTestId("most-improved")).toBeDefined();
  });

  it("class view: each student's total (no minutes per day), no ▲/▼; the student pop-up's Time chart plots active minutes per day", async () => {
    const { fn, calls } = makeFetch({ scoresById: { "g-sch": SCORES_SCHOOL, "t-1": SCORES_CLASS }, timeById: { "t-1": "class" } });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE_SCHOOL} incompleteStates={[]} />);
    fireEvent.doubleClick(await screen.findByTestId("teacher-card"));
    await screen.findAllByTestId("student-tile");

    fireEvent.click(screen.getAllByRole("button", { name: "Time" })[0]);
    fireEvent.click(winBtn("Last seven days"));
    await waitFor(() => expect(screen.getAllByTestId("student-tile")[0].textContent).toContain("84 min"));
    const tiles = screen.getAllByTestId("student-tile");
    // coloured by the window's marks (last seven days: 84 min ≥ 35 → green; 3 min < 10 → red); the figure is the total, captioned by the window
    expect(tiles[0].textContent).not.toContain("per day");
    expect(tiles[0].textContent).toContain("last seven days");
    expect((tiles[0] as HTMLElement).style.background).toBe("rgb(22, 163, 74)");
    expect(tiles[1].textContent).toContain("3 min");
    expect((tiles[1] as HTMLElement).style.background).toBe("rgb(220, 38, 38)");
    for (const tile of tiles) expect(tile.textContent).not.toMatch(/[▲▼→]/);
    // the strip has no caption text (2026-10)
    expect(screen.getByTestId("bar-strip").textContent).not.toContain("click a bar");
    // the class ranks its own students: only the rise counts as improved; top by total minutes
    expect(screen.getByTestId("most-improved").querySelectorAll('[data-testid="rank-row"]').length).toBe(1);
    expect(screen.getByTestId("most-improved").textContent).toContain("+5.0 min");
    expect(screen.getByTestId("top-performing").querySelectorAll('[data-testid="rank-row"]').length).toBe(2);

    // all time: 119 minutes stays in minutes, 120 becomes hours
    fireEvent.click(within(screen.getAllByTestId("time-window-toggle")[0]).getByRole("button", { name: "All time" }));
    await waitFor(() => expect(screen.getAllByTestId("student-tile")[0].textContent).toContain("119 min"));
    expect(screen.getAllByTestId("student-tile")[1].textContent).toContain("2 hours");

    // the student's pop-up: pick Time → the daily active-minutes chart
    fireEvent.click(screen.getAllByTestId("student-tile")[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Time" }));
    await waitFor(() => expect(calls).toContain("/api/proxy/users/s-1/usage-history?range=30&viewer=u-sch"));
    const chart = await within(dialog).findByTestId("minutes-chart");
    expect(chart.textContent).toContain("Active minutes");
    // one bar per day that had activity (the idle day has none)
    expect(chart.querySelectorAll('[data-testid="minutes-bar"]')).toHaveLength(2);
    expect(chart.textContent).toContain("15 Sept");
    // its range toggle refetches
    fireEvent.click(within(dialog).getByRole("button", { name: "All time" }));
    await waitFor(() => expect(calls).toContain("/api/proxy/users/s-1/usage-history?range=all&viewer=u-sch"));
  });

  it("a pp-sketch without Time windows (no window echoed): falls back to the 5+ min yesterday share", async () => {
    // no timeById → the usage request gets a plain response without time fields
    const { fn, calls } = makeFetch({ scoresById: { "g-09": SCORES } });
    vi.stubGlobal("fetch", vi.fn(fn));
    render(<TeacherDashboard profile={PROFILE} incompleteStates={[]} />);
    await screen.findByTestId("map-card");
    await drillIntoUp();
    fireEvent.click(screen.getAllByRole("button", { name: "Time" })[0]);
    await waitFor(() => expect(calls).toContain("/api/proxy/geo-entities/g-09/scores?metric=usage&range=30&window=all&viewer=u1"));
    await waitFor(() => expect(screen.getByTestId("root-kpis").textContent).toContain("of students pass the Time · 5+ min yesterday"));
    expect(screen.getByTestId("root-kpis").textContent).toContain("72%");
    expect(screen.queryByTestId("kpi-per-day")).toBeNull();
  });

  it("MvpMinutesChart: bars for the days with activity, an axis that fits the data, an empty state", () => {
    const { container, rerender } = render(
      <MvpMinutesChart
        label="Active minutes"
        points={[
          { date: "2026-09-15", minutes: 12 },
          { date: "2026-09-16", minutes: 0 },
          { date: "2026-09-17", minutes: 47 },
        ]}
      />,
    );
    expect(container.querySelectorAll('[data-testid="minutes-bar"]')).toHaveLength(2);
    // axis to the next multiple of 10 above the tallest day
    expect(container.textContent).toContain("50");
    expect(container.textContent).not.toContain("60");
    expect(container.textContent).toContain("Active minutes");
    expect(container.textContent).toContain("17 Sept");
    rerender(<MvpMinutesChart label="Active minutes" points={[]} />);
    expect(container.textContent).toContain("No results in this window");
    expect(container.querySelectorAll('[data-testid="minutes-bar"]')).toHaveLength(0);
  });
});
