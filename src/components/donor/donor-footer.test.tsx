import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DonorContact, DonorFooter } from "./donor-footer";

describe("DonorFooter", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("matches www.lifteracy.ai: partner logo, self-hosted policies, registration", () => {
    render(<DonorFooter />);
    expect(screen.getByAltText("Dignity Education")).toBeTruthy();
    expect(screen.getByText("Privacy Policy").getAttribute("href")).toBe("/privacy");
    expect(screen.getByText("Terms and Conditions").getAttribute("href")).toBe("/terms");
    expect(screen.getByText("Child Protection Policy").getAttribute("href")).toBe("/child-protection");
    expect(screen.getByText(/FCRA Registration Number: 231661457/)).toBeTruthy();
    const text = screen.getByTestId("donor-footer").textContent ?? "";
    expect(text).not.toMatch(/padhai/i);
    expect(text).not.toMatch(/Lifteracy/); // always "LIFTeracy"
  });
});

describe("DonorContact", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("asks for help, links the email and signs up through the quiz mailing list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<DonorContact />);
    expect(screen.getByText("hello@lifteracy.ai").getAttribute("href")).toBe("mailto:hello@lifteracy.ai");
    expect(screen.getByText("Get updates")).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.org")).toBeTruthy();
    expect(screen.getByTestId("donor-contact").textContent).toMatch(/seed funding from Ambitious Impact/);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " jane@gmail.com " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/quiz/subscribe", expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "jane@gmail.com" }) }));
    expect(screen.getByText(/you’re signed up/)).toBeTruthy();
  });
});
