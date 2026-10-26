import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManualUpload } from "./manual-upload";

const CSV = [
  "passage_type,passage_text,question_type,question_text,option_a,option_b,correct_option,explanation_a,explanation_b",
  "narrative,राम ने आम खरीदे।,R1.2,राम ने क्या खरीदा?,आम,केले,a,सही,नहीं",
  "narrative,सीता ने केले खरीदे।,R1.2,सीता ने क्या खरीदा?,आम,केले,b,नहीं,", // missing explanation_b
  "narrative,गीता ने अंगूर खरीदे।,R1.2,गीता ने क्या खरीदा?,अंगूर,केले,a,सही,नहीं",
].join("\n");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ManualUpload", () => {
  it("sends only complete rows, one at a time, and shows each outcome with its explanation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "created", level: 9, passage_id: "p1" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "rejected",
            reason: "passage-judge: 10 of 10 valid runs picked a wrong option",
            retriable: false,
            level: 9,
            question: { status: "discarded", explanation: "Answer check failed: …" },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ManualUpload />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([CSV], "tom.csv", { type: "text/csv" })] } });

    const button = await screen.findByRole("button", { name: "Upload & check 2 passages" });
    expect(screen.getByText(/not sent — explanation_b is empty/)).toBeTruthy();
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/passed all checks — live at level 9/)).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Answer check failed: …")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/proxy/media-meta-data/manual-passage");
    expect(bodies.map((b) => b.row)).toEqual([2, 4]);
    expect(bodies[0].filename).toBe("tom.csv");
    // Final rejection → no retry offered.
    expect(screen.queryByRole("button", { name: "retry" })).toBeNull();
  });
});
