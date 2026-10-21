import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FileDropZone, type FileDropZoneProps } from "./file-drop-zone";

const PROMPT = "Drop a file here, or click to browse";
const DRAGGING_PROMPT = "Drop the file to load it";

function makeFile(name = "tune.hcf") {
  return new File(["data"], name, { type: "application/octet-stream" });
}

function renderZone(props: Partial<FileDropZoneProps> = {}) {
  const onFileSelected = vi.fn();
  render(<FileDropZone id="upload" accept=".hcf" onFileSelected={onFileSelected} {...props} />);
  const input = screen.getByLabelText(PROMPT) as HTMLInputElement;
  const zone = screen.getByText(PROMPT).closest<HTMLElement>('[data-slot="file-drop-zone"]');
  if (!zone) throw new Error("drop zone not found");
  return { onFileSelected, input, zone };
}

const FILE_DRAG = { dataTransfer: { types: ["Files"] } };

describe("FileDropZone", () => {
  describe("choosing a file", () => {
    it("has a file input named by the prompt that accepts the given types", () => {
      const { input } = renderZone({ accept: ".hcf,.bin" });

      expect(input).toHaveAttribute("type", "file");
      expect(input).toHaveAttribute("accept", ".hcf,.bin");
    });

    it("shows which file types are accepted", () => {
      renderZone({ accept: ".hcf" });

      expect(screen.getByText("Accepts .hcf")).toBeInTheDocument();
    });

    it("reports the file that was picked", async () => {
      const user = userEvent.setup();
      const { input, onFileSelected } = renderZone();
      const file = makeFile();

      await user.upload(input, file);

      expect(onFileSelected).toHaveBeenCalledTimes(1);
      expect(onFileSelected).toHaveBeenCalledWith(file);
    });

    it("reports the same file again when it is picked a second time", async () => {
      const user = userEvent.setup();
      const { input, onFileSelected } = renderZone();
      const file = makeFile();

      await user.upload(input, file);
      await user.upload(input, file);

      expect(onFileSelected).toHaveBeenCalledTimes(2);
    });

    it("opens the file picker when the zone is clicked", async () => {
      const user = userEvent.setup();
      const { input } = renderZone();
      const onInputClick = vi.fn();
      input.addEventListener("click", onInputClick);

      await user.click(screen.getByText(PROMPT));

      expect(onInputClick).toHaveBeenCalled();
    });

    it("can be reached with the keyboard and opened with Enter and Space", async () => {
      const user = userEvent.setup();
      const { input } = renderZone();
      const onInputClick = vi.fn();
      input.addEventListener("click", onInputClick);

      await user.tab();
      expect(input).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(onInputClick).toHaveBeenCalledTimes(1);

      await user.keyboard(" ");
      expect(onInputClick).toHaveBeenCalledTimes(2);
    });
  });

  describe("dragging a file over the zone", () => {
    it("highlights the zone and changes the prompt", () => {
      const { zone } = renderZone();

      fireEvent.dragEnter(zone, FILE_DRAG);

      expect(screen.getByText(DRAGGING_PROMPT)).toBeInTheDocument();
      expect(zone).toHaveAttribute("data-dragging", "true");
    });

    it("removes the highlight when the file leaves the zone", () => {
      const { zone } = renderZone();

      fireEvent.dragEnter(zone, FILE_DRAG);
      fireEvent.dragLeave(zone);

      expect(screen.getByText(PROMPT)).toBeInTheDocument();
      expect(zone).toHaveAttribute("data-dragging", "false");
    });

    it("keeps the highlight when the pointer moves onto an element inside the zone", () => {
      const { zone } = renderZone();
      const inner = screen.getByText("Accepts .hcf");

      const leave = createEvent.dragLeave(zone);
      Object.defineProperty(leave, "relatedTarget", { value: inner });

      fireEvent.dragEnter(zone, FILE_DRAG);
      fireEvent(zone, leave);

      expect(zone).toHaveAttribute("data-dragging", "true");
    });

    it("does not highlight for a drag that carries no file", () => {
      const { zone } = renderZone();

      fireEvent.dragEnter(zone, { dataTransfer: { types: ["text/plain"] } });

      expect(zone).toHaveAttribute("data-dragging", "false");
    });

    it("does not highlight when disabled", () => {
      const { zone } = renderZone({ disabled: true });

      fireEvent.dragEnter(zone, FILE_DRAG);

      expect(zone).toHaveAttribute("data-dragging", "false");
    });
  });

  describe("dropping a file", () => {
    it("reports the first dropped file and clears the highlight", () => {
      const { zone, onFileSelected } = renderZone();
      const first = makeFile("first.hcf");
      const second = makeFile("second.hcf");

      fireEvent.dragEnter(zone, FILE_DRAG);
      fireEvent.drop(zone, { dataTransfer: { files: [first, second], types: ["Files"] } });

      expect(onFileSelected).toHaveBeenCalledTimes(1);
      expect(onFileSelected).toHaveBeenCalledWith(first);
      expect(zone).toHaveAttribute("data-dragging", "false");
    });

    it("stops the browser from opening the dropped file", () => {
      const { zone } = renderZone();
      const drop = createEvent.drop(zone, {
        dataTransfer: { files: [makeFile()], types: ["Files"] },
      });

      fireEvent(zone, drop);

      expect(drop.defaultPrevented).toBe(true);
    });

    it("allows the drop by cancelling the drag-over event", () => {
      const { zone } = renderZone();
      const dragOver = createEvent.dragOver(zone, FILE_DRAG);

      fireEvent(zone, dragOver);

      expect(dragOver.defaultPrevented).toBe(true);
    });

    it("ignores a drop that carries no file", () => {
      const { zone, onFileSelected } = renderZone();

      fireEvent.drop(zone, { dataTransfer: { files: [], types: ["text/plain"] } });

      expect(onFileSelected).not.toHaveBeenCalled();
    });

    it("ignores a drop when disabled but still stops the browser from opening it", () => {
      const { zone, onFileSelected } = renderZone({ disabled: true });
      const drop = createEvent.drop(zone, {
        dataTransfer: { files: [makeFile()], types: ["Files"] },
      });

      fireEvent(zone, drop);

      expect(onFileSelected).not.toHaveBeenCalled();
      expect(drop.defaultPrevented).toBe(true);
    });
  });

  describe("state shown to the user", () => {
    it("shows the name of the selected file", () => {
      renderZone({ selectedFileName: "my-tune.hcf" });

      expect(screen.getByText("my-tune.hcf")).toBeInTheDocument();
    });

    it("shows no file name when none is selected", () => {
      renderZone();

      expect(screen.queryByText(/Selected/)).not.toBeInTheDocument();
    });

    it("describes the input with the selected file name, the accepted types and the description", () => {
      const { input } = renderZone({
        selectedFileName: "my-tune.hcf",
        description: "Your file stays in this browser.",
      });

      const description = input.getAttribute("aria-describedby");
      expect(description).not.toBeNull();
      expect(input).toHaveAccessibleDescription(expect.stringContaining("my-tune.hcf"));
      expect(input).toHaveAccessibleDescription(expect.stringContaining("Accepts .hcf"));
      expect(input).toHaveAccessibleDescription(
        expect.stringContaining("Your file stays in this browser."),
      );
    });

    it("disables the input when disabled", () => {
      const { input } = renderZone({ disabled: true });

      expect(input).toBeDisabled();
    });
  });
});
