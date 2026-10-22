import { TireIcon } from "@phosphor-icons/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoTuneNotice } from "./no-tune-notice";

describe("NoTuneNotice", () => {
  it("shows its icon, the title No tune loaded, and the description", () => {
    const { container } = render(
      <NoTuneNotice icon={<TireIcon />} description="Upload or select a base tune first." />,
    );

    expect(screen.getByText("No tune loaded")).toBeInTheDocument();
    expect(screen.getByText("Upload or select a base tune first.")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows the title before the description", () => {
    render(<NoTuneNotice icon={<TireIcon />} description="Upload or select a base tune first." />);

    expect(
      screen
        .getByText("No tune loaded")
        .compareDocumentPosition(screen.getByText("Upload or select a base tune first.")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
