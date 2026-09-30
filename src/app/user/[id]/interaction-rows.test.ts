import { describe, expect, it } from "vitest";
import { kindOf, onboardingSaved, onboardingStateLabel, onboardingUnderstood, ROW_TINT, type MediaRow, type OnboardingTurn } from "./interaction-rows";

const turn = (over: Partial<OnboardingTurn>): OnboardingTurn => ({ question: null, next: null, understood: null, saved: [], completed: false, ...over });

describe("interaction-rows", () => {
  it("kindOf defaults to a voice note for rows from an older pp-sketch", () => {
    expect(kindOf({} as MediaRow)).toBe("voice");
    expect(kindOf({ kind: "tap" } as MediaRow)).toBe("tap");
    expect(kindOf({ kind: "onboarding" } as MediaRow)).toBe("onboarding");
    expect(ROW_TINT.voice).toBe("");
    expect(ROW_TINT.tap).not.toBe(ROW_TINT.onboarding);
  });

  it("labels onboarding states as the question asked", () => {
    expect(onboardingStateLabel(null)).toBe("Onboarding started");
    expect(onboardingStateLabel("askGuardian")).toBe("Are you the guardian?");
    expect(onboardingStateLabel("askAge")).toBe("Child's age?");
    expect(onboardingStateLabel("done")).toBe("Onboarding complete");
    // an unknown (future) state is shown as-is rather than hidden
    expect(onboardingStateLabel("askSchool")).toBe("askSchool");
  });

  it("says what the reply was taken to mean", () => {
    expect(onboardingUnderstood(turn({}))).toBeNull();
    expect(onboardingUnderstood(turn({ question: "askGuardian", understood: "YES" }))).toBe("Yes");
    expect(onboardingUnderstood(turn({ question: "askConsent", understood: "NO" }))).toBe("No");
    expect(onboardingUnderstood(turn({ question: "askConsent", understood: "INFORMATION" }))).toBe("Wants more information");
    expect(onboardingUnderstood(turn({ question: "askAge", understood: "UNINTELLIGIBLE" }))).toBe("Could not understand the reply");
    expect(onboardingUnderstood(turn({ question: "askName", understood: "आशा" }))).toBe("आशा");
    expect(onboardingUnderstood(turn({ question: "askName", understood: "NONE" }))).toBe("No name heard");
    expect(onboardingUnderstood(turn({ question: "askAge", understood: "8" }))).toBe("8 years old");
    expect(onboardingUnderstood(turn({ question: "askMonth", understood: "3" }))).toBe("March");
    expect(onboardingUnderstood(turn({ question: "askMonth", understood: "NONE" }))).toBe("No month heard");
    expect(onboardingUnderstood(turn({ question: "askMonth", understood: "13" }))).toBe("13");
    expect(onboardingUnderstood(turn({ question: "somethingNew", understood: "raw" }))).toBe("raw");
  });

  it("lists what the turn saved; the completing turn says the record was written", () => {
    expect(onboardingSaved(turn({}))).toEqual([]);
    expect(onboardingSaved(turn({ saved: [{ field: "name", value: "आशा" }] }))).toEqual(["name: आशा"]);
    expect(onboardingSaved(turn({ saved: [{ field: "birth_year", value: "2018" }] }))).toEqual(["birth year: 2018"]);
    expect(onboardingSaved(turn({ saved: [{ field: "birth_month", value: "3" }], completed: true }))).toEqual([
      "birth month: March",
      "written to the student's record, with recording permission",
    ]);
    expect(onboardingSaved(turn({ completed: true }))).toEqual(["written to the student's record, with recording permission"]);
  });
});
