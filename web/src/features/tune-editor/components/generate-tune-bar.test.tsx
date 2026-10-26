import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { GenerateTuneBar, type GenerateTuneBarProps } from "./generate-tune-bar";

function renderBar(props: Partial<GenerateTuneBarProps> = {}) {
  const handlers = {
    onFileNameChange: vi.fn(),
    onGenerate: vi.fn(),
    onResetAll: vi.fn(),
  };
  render(
    <GenerateTuneBar
      fileName="my-tune"
      changedShiftPoints={0}
      idleChanged={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function StatefulBar({ onFileNameChange }: { onFileNameChange(value: string): void }) {
  const [fileName, setFileName] = React.useState("");
  return (
    <GenerateTuneBar
      fileName={fileName}
      onFileNameChange={(value) => {
        onFileNameChange(value);
        setFileName(value);
      }}
      changedShiftPoints={0}
      idleChanged={false}
      onGenerate={vi.fn()}
    />
  );
}

describe("GenerateTuneBar", () => {
  describe("output file name", () => {
    it("shows the file name in a labelled input", () => {
      renderBar({ fileName: "daily-34in" });

      expect(screen.getByLabelText("Output file")).toHaveValue("daily-34in");
    });

    it("shows the .hcf extension next to the input", () => {
      renderBar();

      expect(screen.getByText(".hcf")).toBeInTheDocument();
    });

    it("tells screen reader users that the extension is added", () => {
      renderBar();

      expect(screen.getByLabelText("Output file")).toHaveAccessibleDescription(
        "The .hcf extension is added for you.",
      );
    });

    it("reports what the user types", async () => {
      const user = userEvent.setup();
      const onFileNameChange = vi.fn();
      render(<StatefulBar onFileNameChange={onFileNameChange} />);

      await user.type(screen.getByLabelText("Output file"), "abc");

      expect(onFileNameChange).toHaveBeenLastCalledWith("abc");
      expect(onFileNameChange).toHaveBeenCalledTimes(3);
    });
  });

  describe("change summary", () => {
    it("says there are no changes when nothing changed", () => {
      renderBar();

      expect(screen.getByText("No changes")).toBeInTheDocument();
    });

    it("counts changed shift points and mentions the idle change", () => {
      renderBar({ changedShiftPoints: 3, idleChanged: true });

      expect(screen.getByText("3 shift points changed · idle changed")).toBeInTheDocument();
    });

    it("uses the singular for one shift point", () => {
      renderBar({ changedShiftPoints: 1 });

      expect(screen.getByText("1 shift point changed")).toBeInTheDocument();
    });

    it("counts changed lockup speeds and firmness values", () => {
      renderBar({ changedShiftPoints: 1, changedLockupPoints: 2, changedFirmnessPoints: 1 });

      expect(
        screen.getByText(
          "1 shift point changed · 2 lockup speeds changed · 1 firmness value changed",
        ),
      ).toBeInTheDocument();
    });

    it("uses the singular for one lockup speed", () => {
      renderBar({ changedLockupPoints: 1 });

      expect(screen.getByText("1 lockup speed changed")).toBeInTheDocument();
    });

    it("starts with a capital letter when only the idle changed", () => {
      renderBar({ idleChanged: true });

      expect(screen.getByText("Idle changed")).toBeInTheDocument();
    });
  });

  describe("Generate Tune button", () => {
    it("is enabled and reports a click", async () => {
      const user = userEvent.setup();
      const { onGenerate } = renderBar();

      await user.click(screen.getByRole("button", { name: "Generate Tune" }));

      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it("is aria-disabled and still focusable when a reason is given, and shows that reason next to it", async () => {
      const user = userEvent.setup();
      const { onGenerate } = renderBar({ disabledReason: "Enter the chip serial first." });
      const button = screen.getByRole("button", { name: "Generate Tune" });

      await user.click(button);

      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      expect(button).toHaveFocus();
      expect(screen.getByText("Enter the chip serial first.")).toBeInTheDocument();
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("does nothing when it is activated from the keyboard while aria-disabled", async () => {
      const user = userEvent.setup();
      const { onGenerate } = renderBar({
        disabledReason: "Enter the chip serial first.",
        onResetAll: undefined,
      });
      const button = screen.getByRole("button", { name: "Generate Tune" });

      await user.tab();
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");

      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("describes the disabled button with the reason", () => {
      renderBar({ disabledReason: "Enter the chip serial first." });

      expect(screen.getByRole("button", { name: "Generate Tune" })).toHaveAccessibleDescription(
        "Enter the chip serial first.",
      );
    });

    it("shows no reason and no description when enabled", () => {
      renderBar();

      const button = screen.getByRole("button", { name: "Generate Tune" });
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute("aria-disabled");
      expect(button).not.toHaveAccessibleDescription();
    });

    it("shows a spinner and Generating… while generating, and cannot be pressed again", async () => {
      const user = userEvent.setup();
      const { onGenerate } = renderBar({ generating: true });
      const button = screen.getByRole("button", { name: "Generating…" });

      await user.click(button);

      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
      expect(screen.queryByRole("button", { name: "Generate Tune" })).not.toBeInTheDocument();
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("keeps focus when a press starts generating", async () => {
      const user = userEvent.setup();
      function GeneratingHarness() {
        const [generating, setGenerating] = React.useState(false);
        return (
          <GenerateTuneBar
            fileName="my-tune"
            onFileNameChange={vi.fn()}
            changedShiftPoints={0}
            idleChanged={false}
            generating={generating}
            onGenerate={() => setGenerating(true)}
          />
        );
      }
      render(<GeneratingHarness />);
      const button = screen.getByRole("button", { name: "Generate Tune" });
      await user.click(button);

      expect(screen.getByRole("button", { name: "Generating…" })).toBe(button);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("aria-disabled", "true");
    });

    it("keeps the reason linked while it is also generating", () => {
      renderBar({ generating: true, disabledReason: "Enter the chip serial first." });

      expect(screen.getByRole("button", { name: "Generating…" })).toHaveAccessibleDescription(
        "Enter the chip serial first.",
      );
    });

    it("shows no spinner when not generating", () => {
      renderBar();

      expect(document.querySelector('[data-slot="spinner"]')).toBeNull();
    });
  });

  describe("Reset all changes button", () => {
    it("is shown and reports a click when something changed and a handler is given", async () => {
      const user = userEvent.setup();
      const { onResetAll } = renderBar({ changedShiftPoints: 2 });
      const button = screen.getByRole("button", { name: "Reset all changes" });

      await user.click(button);

      expect(button).not.toHaveAttribute("aria-disabled");
      expect(onResetAll).toHaveBeenCalledTimes(1);
    });

    it("is available when only the idle changed", () => {
      renderBar({ idleChanged: true });

      const button = screen.getByRole("button", { name: "Reset all changes" });

      expect(button).not.toHaveAttribute("aria-disabled");
    });

    it("is available when only a lockup speed changed", () => {
      renderBar({ changedLockupPoints: 1 });

      expect(screen.getByRole("button", { name: "Reset all changes" })).not.toHaveAttribute(
        "aria-disabled",
      );
    });

    it("is available when only a firmness value changed", () => {
      renderBar({ changedFirmnessPoints: 1 });

      expect(screen.getByRole("button", { name: "Reset all changes" })).not.toHaveAttribute(
        "aria-disabled",
      );
    });

    it("is shown but aria-disabled when nothing changed, and does nothing when pressed", async () => {
      const user = userEvent.setup();
      const { onResetAll } = renderBar();
      const button = screen.getByRole("button", { name: "Reset all changes" });

      await user.click(button);
      await user.keyboard("{Enter}");

      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      expect(button).toHaveFocus();
      expect(onResetAll).not.toHaveBeenCalled();
    });

    it("is hidden when no handler is given", () => {
      renderBar({ changedShiftPoints: 2, onResetAll: undefined });

      expect(screen.queryByRole("button", { name: "Reset all changes" })).not.toBeInTheDocument();
    });

    it("is hidden when no handler is given and nothing changed", () => {
      renderBar({ onResetAll: undefined });

      expect(screen.queryByRole("button", { name: "Reset all changes" })).not.toBeInTheDocument();
    });

    it("is aria-disabled while generating, and does nothing when pressed", async () => {
      const user = userEvent.setup();
      const { onResetAll } = renderBar({ changedShiftPoints: 2, generating: true });
      const button = screen.getByRole("button", { name: "Reset all changes" });

      await user.click(button);

      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      expect(onResetAll).not.toHaveBeenCalled();
    });

    it("keeps focus after a reset removes the last change", async () => {
      const user = userEvent.setup();
      function ResetHarness() {
        const [changed, setChanged] = React.useState(3);
        return (
          <GenerateTuneBar
            fileName="my-tune"
            onFileNameChange={vi.fn()}
            changedShiftPoints={changed}
            idleChanged={false}
            onGenerate={vi.fn()}
            onResetAll={() => setChanged(0)}
          />
        );
      }
      render(<ResetHarness />);
      const button = screen.getByRole("button", { name: "Reset all changes" });
      await user.tab();
      await user.tab();
      expect(button).toHaveFocus();

      await user.keyboard("{Enter}");

      expect(screen.getByRole("button", { name: "Reset all changes" })).toBe(button);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByText("No changes")).toBeInTheDocument();
    });
  });
});
