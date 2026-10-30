import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import {
  JustificationPanel,
  insertAiTextIntoQ12b,
  officerQ12bFor,
  type JustificationPanelProps,
} from "@/components/justification-modal";
import type { Case } from "@/app/api/cases/types";

const AI_TEXT = "[AI SUGGESTION] The device meets the functional need.";
const OFFICER_TEXT = "Officer wrote this 12(b) by hand.";

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: "case-1",
    caseNumber: "2101P",
    status: "pending",
    justification: "",
    tranche: "T12",
    egData: { Q12b_Jus: "" },
    applicationData: { PA_PName: "Widget" },
    catalogueData: {},
    ...overrides,
  } as unknown as Case;
}

function renderPanel(props: Partial<JustificationPanelProps> = {}) {
  const onGenerate = vi.fn().mockResolvedValue({
    text: AI_TEXT,
    aiDecision: "approved",
    aiReasoning: "fits",
  });
  const onConfirm = vi.fn();
  const onSaveDraft = vi.fn();
  const utils = render(
    <JustificationPanel
      open
      onClose={() => {}}
      selectedCase={makeCase()}
      initialDecision="approved"
      isGenerating={false}
      isUpdating={false}
      onGenerate={onGenerate}
      onConfirm={onConfirm}
      onSaveDraft={onSaveDraft}
      {...props}
    />,
  );
  return { ...utils, onGenerate, onConfirm, onSaveDraft };
}

const officerField = () =>
  screen.getByTestId("officer-q12b") as HTMLTextAreaElement;

beforeEach(() => {
  // No cached generation for the prefill lookup.
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => null }) as any;
  // jsdom lacks these.
  (Element.prototype as any).scrollIntoView = vi.fn();
});

describe("officerQ12bFor", () => {
  it("prefers the EG form's Q12b_Jus, falls back to case.justification", () => {
    expect(officerQ12bFor(makeCase({ egData: { Q12b_Jus: "eg" }, justification: "j" } as any))).toBe("eg");
    expect(officerQ12bFor(makeCase({ egData: {}, justification: "j" } as any))).toBe("j");
    expect(officerQ12bFor(null)).toBe("");
  });
});

describe("insertAiTextIntoQ12b", () => {
  it("fills an empty field and appends to existing officer text", () => {
    expect(insertAiTextIntoQ12b("", AI_TEXT)).toBe(AI_TEXT);
    expect(insertAiTextIntoQ12b(OFFICER_TEXT, AI_TEXT)).toBe(`${OFFICER_TEXT}\n\n${AI_TEXT}`);
    expect(insertAiTextIntoQ12b(OFFICER_TEXT, "  ")).toBe(OFFICER_TEXT);
  });
});

describe("JustificationPanel — officer 12(b) vs AI suggestion", () => {
  it("Generate shows AI text in the separate panel and does NOT modify the officer's 12(b)", async () => {
    const onDraftChange = vi.fn();
    const { onGenerate } = renderPanel({ onDraftChange });
    fireEvent.change(officerField(), { target: { value: OFFICER_TEXT } });
    onDraftChange.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    });

    expect(onGenerate).toHaveBeenCalledTimes(1);
    // The AI sees the officer's current text as the existing remarks.
    expect(onGenerate.mock.calls[0][0].Q12b_Jus).toBe(OFFICER_TEXT);
    await screen.findByTestId("ai-suggestion-text");
    expect(screen.getByTestId("ai-suggestion-text")).toHaveTextContent(AI_TEXT);
    expect(screen.getByTestId("ai-suggestion-panel")).toHaveTextContent(/reference only/i);
    expect(officerField().value).toBe(OFFICER_TEXT);
    // The host's EG-form row is not touched by a generation either.
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it("Confirm saves the officer's text, not the AI suggestion", async () => {
    const { onConfirm } = renderPanel();
    fireEvent.change(officerField(), { target: { value: OFFICER_TEXT } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    });
    await screen.findByTestId("ai-suggestion-text");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toBe(OFFICER_TEXT);
    expect(onConfirm.mock.calls[0][1]).toBe("approved");
    expect(onConfirm.mock.calls[0][2].egPatch.Q12b_Jus).toBeUndefined();
  });

  it("Confirm is gated on the officer's 12(b), not on AI text", async () => {
    renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    });
    await screen.findByTestId("ai-suggestion-text");
    expect(officerField().value).toBe("");
    expect(screen.getByRole("button", { name: /confirm approval/i })).toBeDisabled();
    fireEvent.change(officerField(), { target: { value: OFFICER_TEXT } });
    expect(screen.getByRole("button", { name: /confirm approval/i })).toBeEnabled();
  });

  it("Save Draft saves the officer's text as Q12b without an overwrite warning", async () => {
    const { onSaveDraft } = renderPanel();
    fireEvent.change(officerField(), { target: { value: OFFICER_TEXT } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    });
    await screen.findByTestId("ai-suggestion-text");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    });
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onSaveDraft.mock.calls[0][0].justification).toBe(OFFICER_TEXT);
    expect(onSaveDraft.mock.calls[0][0].q12bJus).toBe(OFFICER_TEXT);
    expect(screen.queryByText(/override existing eg remarks/i)).toBeNull();
  });

  it("Copy AI text into my 12(b) copies it in (opt-in), mirrors to host, and stays editable", async () => {
    const onDraftChange = vi.fn();
    const { onConfirm } = renderPanel({ onDraftChange });
    fireEvent.change(officerField(), { target: { value: OFFICER_TEXT } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    });
    await screen.findByTestId("ai-suggestion-text");
    expect(officerField().value).toBe(OFFICER_TEXT);

    fireEvent.click(screen.getByTestId("copy-ai-to-q12b"));
    const expected = `${OFFICER_TEXT}\n\n${AI_TEXT}`;
    expect(officerField().value).toBe(expected);
    expect(onDraftChange).toHaveBeenLastCalledWith(expected);

    fireEvent.change(officerField(), { target: { value: expected + " Edited." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));
    });
    expect(onConfirm.mock.calls[0][0]).toBe(expected + " Edited.");
  });

  it("prefills the officer's 12(b) from the saved case and a cached generation only fills the AI panel", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ generatedJustification: AI_TEXT, aiDecision: "approved" }),
    }) as any;
    renderPanel({
      selectedCase: makeCase({ egData: { Q12b_Jus: OFFICER_TEXT } } as any),
    });
    await waitFor(() =>
      expect(screen.getByTestId("ai-suggestion-text")).toHaveTextContent(AI_TEXT),
    );
    expect(officerField().value).toBe(OFFICER_TEXT);
  });

  it("host-owned Q12b (copy dialog) seeds the officer field even with a similar-case seed", async () => {
    renderPanel({
      externalJustification: "Typed on the left",
      hideEgRemarksInput: true,
      hideDecisionDetails: true,
      seedSimilarCase: { id: "seed-1", productName: "X", decision: "approved", similarity: 0.9 } as any,
    });
    await waitFor(() => expect(officerField().value).toBe("Typed on the left"));
  });
});
