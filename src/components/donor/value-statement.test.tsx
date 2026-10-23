import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Caveat: () => ({ className: "caveat" }) }));

const { ValueStatement } = await import("./value-statement");
const { CostEffectiveness } = await import("./cost-effectiveness");

describe("ValueStatement", () => {
  afterEach(cleanup);

  it("one dot per variation picks the headline; no source note; the MPL-B claim follows", () => {
    render(<ValueStatement />);
    const dots = screen.getAllByTestId("value-dot");
    expect(dots).toHaveLength(7);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("$200T of economic value");
    fireEvent.click(dots[5]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("12 million child deaths");
    expect(dots[5].getAttribute("aria-current")).toBe("true");
    expect(document.querySelector("sup")).toBeNull();
    expect(screen.getByTestId("mpl-b-claim").textContent).toMatch(/^LIFTeracy is the only Hindi EdTech tool .*\(MPL-B\) without supplemental teaching input\.$/);
  });
});

describe("CostEffectiveness", () => {
  afterEach(cleanup);

  it("$31 against the $60 bar, both sourced; the trial caveat as a footnote", () => {
    render(<CostEffectiveness />);
    expect(screen.getByTestId("cost-lifteracy").getAttribute("href")).toBe("https://claude.ai/artifact/Kxii4TUevmNLubo2WqygFx");
    expect(screen.getByTestId("cost-aim-bar").getAttribute("href")).toBe("https://research.ambitiousimpact.com/ambitious-impact-eval/evaluative-criteria");
    expect(screen.getByText("$31 per income doubling at scale").tagName).toBe("A");
    expect(screen.getByText("Ambitious Impact’s funding bar of $60").tagName).toBe("A");
    expect(screen.getByText("This estimate needs to be tested with a randomized control trial.").className).toContain("text-sm");
  });
});
