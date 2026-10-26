import { changedOffsets, HcfCodec, readTuneValues, TDE1, type GridId } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FuelPowerModule } from "./sections/fuel-power-module";
import { GenerateSection } from "./sections/generate-section";
import { TimingIcpModule } from "./sections/timing-icp-module";
import { TuneStatus } from "./sections/tune-status";
import { UploadSection } from "./sections/upload-section";
import { BaseTuneModule } from "./sections/base-tune-module";
import { LibrarySection } from "./sections/library-section";
import { TuneEditorProvider } from "./tune-editor-provider";

const SERIAL = "0A1B2C3D";
const FUEL = "Fuel and power";
const TIMING = "Timing and ICP";

type SaveDialogWindow = Window & { showSaveFilePicker?: unknown };

function hcfFile(name = "tune.hcf"): File {
  const bytes = new HcfCodec(SERIAL).encode(buildTde1Image());
  return new File([bytes.slice()], name, { type: "application/octet-stream" });
}

function renderEditor() {
  return render(
    <TuneEditorProvider>
      <BaseTuneModule
        upload={<UploadSection />}
        library={<LibrarySection tunes={[]} sourceUrl="https://example.com/library" />}
      />
      <TuneStatus />
      <FuelPowerModule />
      <TimingIcpModule />
      <GenerateSection />
    </TuneEditorProvider>,
  );
}

async function openTune(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Chip serial"), SERIAL);
  await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile());
  await screen.findByText(/^Editing/);
}

function moduleCard(title: string): HTMLElement {
  const card = screen
    .getByRole("heading", { level: 2, name: title })
    .closest<HTMLElement>('[data-slot="card"]');
  if (!card) throw new Error(`No module card for ${title}`);
  return card;
}

function toggle(title: string): HTMLElement {
  return screen.getByRole("button", { name: title });
}

/** The number fields of the open grid, row by row. */
function cells(label: string): HTMLInputElement[] {
  return screen.getAllByRole<HTMLInputElement>("textbox", {
    name: (name) => name.startsWith(`${label}, `),
  });
}

async function typeInto(
  user: ReturnType<typeof userEvent.setup>,
  field: HTMLElement,
  text: string,
) {
  await user.clear(field);
  await user.type(field, text);
}

function offsetsOf(id: GridId, row: number, col: number): number[] {
  const grid = TDE1.grids.find((candidate) => candidate.id === id);
  if (!grid) throw new Error(`no grid ${id}`);
  const start = grid.address + (row * grid.rowStride + col) * grid.cellBytes;
  return Array.from({ length: grid.cellBytes }, (_unused, byte) => start + byte);
}

afterEach(() => {
  delete (window as SaveDialogWindow).showSaveFilePicker;
  vi.restoreAllMocks();
});

describe("Fuel and power and Timing and ICP modules", () => {
  it("starts both collapsed, with no tune loaded in the summary", () => {
    renderEditor();

    for (const title of [FUEL, TIMING]) {
      expect(toggle(title)).toHaveAttribute("aria-expanded", "false");
      expect(within(moduleCard(title)).getByText("No tune loaded")).toBeInTheDocument();
    }
  });

  it("shows a No tune loaded notice and no grid before a tune is loaded", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(toggle(FUEL));

    const card = within(moduleCard(FUEL));
    expect(card.getByText("No tune loaded")).toBeInTheDocument();
    expect(card.queryByRole("table")).not.toBeInTheDocument();
    expect(card.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("shows No changes when collapsed after a tune loads", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    for (const title of [FUEL, TIMING]) {
      expect(within(moduleCard(title)).getByText("No changes")).toBeInTheDocument();
    }
  });

  it("lists the six grids of each module as tabs and shows the first with its description", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await user.click(toggle(FUEL));
    await user.click(toggle(TIMING));

    const fuel = within(moduleCard(FUEL));
    expect(fuel.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Maximum fuel",
      "Base injector pulse width",
      "Pulse width multiplier",
      "Fuel demand",
      "Fuel limit, sea level",
      "Fuel limit, altitude",
    ]);
    expect(fuel.getByRole("tab", { name: "Maximum fuel" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(fuel.getByText(/^Maximum fuel against engine speed\./)).toBeInTheDocument();
    expect(fuel.getAllByRole("table")).toHaveLength(1);
    const timing = within(moduleCard(TIMING));
    expect(timing.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Base injection timing, sea level",
      "Base injection timing, altitude",
      "Time added to timing",
      "Timing correction",
      "Desired ICP",
      "IPR duty feed-forward",
    ]);
  });

  it("warns, in one sentence, that these grids can damage the engine", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await user.click(toggle(FUEL));
    await user.click(toggle(TIMING));

    expect(within(moduleCard(FUEL)).getByText(/can damage the engine/)).toBeInTheDocument();
    expect(within(moduleCard(TIMING)).getByText(/can damage the engine/)).toBeInTheDocument();
  });

  it("shows another grid when its tab is chosen", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(FUEL));

    await user.click(screen.getByRole("tab", { name: "Pulse width multiplier" }));

    expect(cells("Pulse width multiplier")).toHaveLength(11 * 16);
    expect(screen.queryByRole("group", { name: "Maximum fuel" })).not.toBeInTheDocument();
    expect(screen.getByText("Multiplier for the base pulse width. 0x1000 is 1.0.")).toBeVisible();
  });

  it("exposes all 13 x 13 cells of the base pulse width and dims the rows the tune does not reach", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(FUEL));

    await user.click(screen.getByRole("tab", { name: "Base injector pulse width" }));

    expect(cells("Base injector pulse width")).toHaveLength(13 * 13);
    const group = within(screen.getByRole("group", { name: "Base injector pulse width" }));
    expect(
      group
        .getAllByRole("rowheader")
        .slice(11)
        .map((h) => h.textContent),
    ).toEqual(["index 11 (not reached by this tune)", "index 12 (not reached by this tune)"]);
  });

  it("shows the pulse width multiplier as a multiplier, and stores what is typed", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(FUEL));
    await user.click(screen.getByRole("tab", { name: "Pulse width multiplier" }));
    const original = readTuneValues(buildTde1Image()).gridsRaw["pulse-width-multiplier"][0] ?? 0;
    const [first] = cells("Pulse width multiplier");

    expect(first).toHaveValue((original / 4096).toFixed(4));
    await typeInto(user, first as HTMLElement, "1.5");
    await user.tab();

    expect(cells("Pulse width multiplier")[0]).toHaveValue("1.5000");
    expect(cells("Pulse width multiplier")[0]).toHaveAccessibleDescription(
      `was ${(original / 4096).toFixed(4)}`,
    );
  });
});

describe("edits of grid cells", () => {
  it("keeps edits while the module is collapsed, and counts them in its summary", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(FUEL));
    await typeInto(user, cells("Maximum fuel")[0] as HTMLElement, "100");
    await typeInto(user, cells("Maximum fuel")[1] as HTMLElement, "101");
    await user.click(screen.getByRole("tab", { name: /^Fuel demand/ }));
    await typeInto(user, cells("Fuel demand")[0] as HTMLElement, "5");

    await user.click(toggle(FUEL));

    expect(within(moduleCard(FUEL)).getByText("3 cells changed in 2 grids")).toBeInTheDocument();
    expect(within(moduleCard(TIMING)).getByText("No changes")).toBeInTheDocument();

    await user.click(toggle(FUEL));
    await user.click(screen.getByRole("tab", { name: /^Maximum fuel/ }));

    expect(cells("Maximum fuel")[0]).toHaveValue("100");
  });

  it("counts the changed cells in the Generate bar", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(TIMING));
    await user.click(screen.getByRole("tab", { name: "Desired ICP" }));

    await typeInto(user, cells("Desired ICP")[0] as HTMLElement, "1000");

    expect(screen.getByText("1 grid cell changed")).toBeInTheDocument();
  });

  it("scales a whole grid, rounded and clamped, from the toolbar", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(FUEL));
    await user.click(screen.getByRole("tab", { name: "Fuel limit, sea level" }));
    const before = cells("Fuel limit, sea level").map((field) => Number(field.value));

    await typeInto(user, screen.getByRole("textbox", { name: "Scale grid by %" }), "200");
    await user.click(screen.getByRole("button", { name: "Apply scale" }));

    expect(cells("Fuel limit, sea level").map((field) => Number(field.value))).toEqual(
      before.map((cell) => Math.min(255, Math.round(cell * 2))),
    );
  });

  it("resets one grid with Reset grid and leaves the other grid's edits", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(FUEL));
    const original = cells("Maximum fuel")[0]?.value;
    await typeInto(user, cells("Maximum fuel")[0] as HTMLElement, "100");
    await user.click(screen.getByRole("tab", { name: /^Fuel demand/ }));
    await typeInto(user, cells("Fuel demand")[0] as HTMLElement, "5");

    await user.click(screen.getByRole("tab", { name: /^Maximum fuel/ }));
    await user.click(screen.getByRole("button", { name: "Reset grid" }));

    expect(cells("Maximum fuel")[0]).toHaveValue(original);
    await user.click(screen.getByRole("tab", { name: /^Fuel demand/ }));
    expect(cells("Fuel demand")[0]).toHaveValue("5");
  });

  it("puts the grids back on Reset all changes", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(FUEL));
    const original = cells("Maximum fuel")[0]?.value;
    await typeInto(user, cells("Maximum fuel")[0] as HTMLElement, "100");

    await user.click(screen.getByRole("button", { name: "Reset all changes" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));

    expect(cells("Maximum fuel")[0]).toHaveValue(original);
    await user.click(toggle(FUEL));
    expect(within(moduleCard(FUEL)).getByText("No changes")).toBeInTheDocument();
  });

  it("asks before another tune replaces edited grid cells", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await user.click(toggle(FUEL));
    await typeInto(user, cells("Maximum fuel")[0] as HTMLElement, "100");

    await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile("other.hcf"));

    expect(await screen.findByRole("alertdialog", { name: "Discard your changes?" })).toBeVisible();
  });
});

describe("Generate Tune with grid edits", () => {
  it("writes the edited cells of two grids and no other byte", async () => {
    const user = userEvent.setup();
    let written: Uint8Array | undefined;
    (window as SaveDialogWindow).showSaveFilePicker = vi.fn(async () => ({
      name: "out.hcf",
      createWritable: async () => ({
        write: async (data: Uint8Array) => {
          written = data;
        },
        close: async () => {},
      }),
    }));
    renderEditor();
    await openTune(user);
    const original = readTuneValues(buildTde1Image());
    await user.click(toggle(FUEL));
    await user.click(screen.getByRole("tab", { name: "Pulse width multiplier" }));
    await typeInto(user, cells("Pulse width multiplier")[17] as HTMLElement, "1.5");
    await user.click(toggle(TIMING));
    await user.click(screen.getByRole("tab", { name: "Desired ICP" }));
    await typeInto(user, cells("Desired ICP")[12] as HTMLElement, "1000");

    await user.click(screen.getByRole("button", { name: "Generate Tune" }));

    await waitFor(() => expect(written).toBeDefined());
    const image = new HcfCodec(SERIAL).decode(written as Uint8Array);
    const uploaded = new HcfCodec(SERIAL).decode(new HcfCodec(SERIAL).encode(buildTde1Image()));
    const saved = readTuneValues(image).gridsRaw;
    expect(saved["pulse-width-multiplier"][17]).toBe(6144);
    expect(saved["desired-icp"][12]).toBe(1000);
    const oldMultiplier = original.gridsRaw["pulse-width-multiplier"][17] ?? 0;
    const oldIcp = original.gridsRaw["desired-icp"][12] ?? 0;
    const expected = [
      ...differingBytes(offsetsOf("pulse-width-multiplier", 1, 1), oldMultiplier, 6144),
      ...differingBytes(offsetsOf("desired-icp", 1, 1), oldIcp, 1000),
    ].sort((a, b) => a - b);
    expect(expected.length).toBeGreaterThan(0);
    expect(changedOffsets(uploaded, image)).toEqual(expected);
  });
});

/** The offsets of a two-byte little-endian cell whose byte changes between `before` and `after`. */
function differingBytes(offsets: number[], before: number, after: number): number[] {
  const bytes = (value: number) => [value & 0xff, (value >> 8) & 0xff];
  return offsets.filter((_offset, byte) => bytes(before)[byte] !== bytes(after)[byte]);
}
