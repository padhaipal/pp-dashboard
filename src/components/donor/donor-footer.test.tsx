import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DonorFooter } from "./donor-footer";

describe("DonorFooter", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("matches www.lifteracy.ai: partner logo, sign-up, contact, policies, registration", () => {
    render(<DonorFooter />);
    expect(screen.getByAltText("Dignity Education")).toBeTruthy();
    expect(screen.getByText("Sign up for Updates!")).toBeTruthy();
    expect(screen.getByText("hello@lifteracy.ai").getAttribute("href")).toBe("mailto:hello@lifteracy.ai");
    for (const p of ["Privacy Policy", "Terms and Conditions", "Child Protection Policy"]) expect(screen.getByText(p).getAttribute("href")).toMatch(/^https:\/\/drive\.google\.com\//);
    expect(screen.getByText(/FCRA Registration Number: 231661457/)).toBeTruthy();
    const text = screen.getByTestId("donor-footer").textContent ?? "";
    expect(text).not.toMatch(/padhai/i);
    expect(text).not.toMatch(/Lifteracy/); // always "LIFTeracy"
  });

  it("signs up through the quiz mailing list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<DonorFooter />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " jane@gmail.com " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/quiz/subscribe", expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "jane@gmail.com" }) }));
    expect(screen.getByText(/you’re signed up/)).toBeTruthy();
  });
});
