import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DiscardChangesDialog } from "./discard-changes-dialog";

describe("DiscardChangesDialog", () => {
  it("shows nothing without a request", () => {
    render(<DiscardChangesDialog request={null} onClose={() => {}} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("runs the action only when the person confirms", async () => {
    const user = userEvent.setup();
    const proceed = vi.fn();
    const onClose = vi.fn();
    render(
      <DiscardChangesDialog request={{ message: "Opening b.hcf replaces it.", proceed }} onClose={onClose} />,
    );

    const dialog = screen.getByRole("alertdialog", { name: "Discard your changes?" });
    expect(dialog).toHaveTextContent("Opening b.hcf replaces it.");
    await user.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(proceed).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes without running the action when the person keeps editing", async () => {
    const user = userEvent.setup();
    const proceed = vi.fn();
    const onClose = vi.fn();
    render(<DiscardChangesDialog request={{ message: "x", proceed }} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(proceed).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
