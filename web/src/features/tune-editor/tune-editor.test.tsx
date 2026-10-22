import { Blowfish, changedOffsets, HcfCodec, readTuneValues } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LibraryTuneOption } from "./components/library-tune-picker";
import { BaseTuneModule } from "./sections/base-tune-module";
import { GenerateSection } from "./sections/generate-section";
import { IdleModule } from "./sections/idle-module";
import { LibrarySection } from "./sections/library-section";
import { ShiftPointsModule } from "./sections/shift-points-module";
import { TiresModule } from "./sections/tires-module";
import { TuneStatus } from "./sections/tune-status";
import { UploadSection } from "./sections/upload-section";
import { TuneEditorProvider } from "./tune-editor-provider";

const SERIAL = "0A1B2C3D";

/** The text the "About shift points" popover holds, word for word. */
const SHIFT_POINTS_HELP =
  "Shift point is the speed stored in the tune; the PCM computes it for the calibration tire size. Speedometer is the road speed on the tires entered, which a speedometer calibrated for those tires shows. If the speedometer was not recalibrated for the tires, the dash shows the shift point instead. Editing either column updates the other.";

const TIRES_NO_TUNE_MESSAGE = "Upload or select a base tune to set the tires on the truck.";
const STOCK_OPTION: LibraryTuneOption = {
  fileName: "VCAB0_02_0S.efu",
  code: "0S",
  label: "Stock",
  category: "stock",
  categoryLabel: "Stock & diagnostic",
  valveBody: false,
};

type SaveDialogWindow = Window & { showSaveFilePicker?: unknown };

function hcfFile(name = "tune.hcf"): File {
  const bytes = new HcfCodec(SERIAL).encode(buildTde1Image());
  return new File([bytes.slice()], name, { type: "application/octet-stream" });
}

/** A PHP library file: the image plus an 08 x 8 trailer, encrypted with PHP's fixed key. */
function efuBytes(): Uint8Array {
  const plain = new Uint8Array(262_152).fill(0x08);
  plain.set(buildTde1Image());
  return new Blowfish(new Uint8Array([0xbd, 0xc3, 0x07, 0x27, 0x69])).encryptEcb(plain);
}

/** The modules in the order the page shows them: left column, right column, full width. */
function renderEditor(tunes: LibraryTuneOption[] = []) {
  return render(
    <TuneEditorProvider>
      <BaseTuneModule
        upload={<UploadSection />}
        library={
          <LibrarySection tunes={tunes} sourceUrl="https://gopowerhungry.com/pages/hydra-chip" />
        }
      />
      <TuneStatus />
      <IdleModule />
      <TiresModule />
      <ShiftPointsModule />
      <GenerateSection />
    </TuneEditorProvider>,
  );
}

function curveInput(title: string, throttle: string, column: "shift point" | "speedometer") {
  return screen.getByRole("textbox", { name: `${title}, ${throttle} throttle, ${column} (mph)` });
}

/**
 * Enters a size on the Manual tab of a tire group as its Width, Height and Rim, for example
 * ["315", "75", "16"] for 315/75R16 or ["12.50", "35", "17"] for 35x12.50R17, then leaves it.
 */
async function setTire(
  user: ReturnType<typeof userEvent.setup>,
  group: string,
  [width, height, rim]: readonly [string, string, string],
) {
  const fields = within(screen.getByRole("group", { name: group }));
  await user.click(fields.getByRole("tab", { name: "Manual tire size" }));
  for (const [name, text] of [
    ["Width", width],
    ["Height", height],
    ["Rim", rim],
  ] as const) {
    const input = fields.getByRole("textbox", { name });
    await user.clear(input);
    await user.type(input, text);
  }
  await user.tab();
}

/** Opens the list of a tire group, types a search and clicks the option with the given name. */
async function chooseTire(
  user: ReturnType<typeof userEvent.setup>,
  group: string,
  search: string,
  option: string | RegExp,
) {
  const fields = within(screen.getByRole("group", { name: group }));
  await user.click(fields.getByRole("combobox", { name: new RegExp(`^${group}`) }));
  await user.type(screen.getByRole("combobox", { name: "Search tire sizes" }), search);
  await user.click(screen.getByRole("option", { name: option }));
}

async function openTune(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Chip serial"), SERIAL);
  await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile());
  await screen.findByText(/^Editing/);
}

afterEach(() => {
  delete (window as SaveDialogWindow).showSaveFilePicker;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Drops a file on the drop zone. Unlike the file input, a drop is not filtered by `accept`. */
function dropFile(file: File) {
  const zone = screen
    .getByText(/drop a file here/i)
    .closest<HTMLElement>('[data-slot="file-drop-zone"]');
  if (!zone) throw new Error("drop zone not found");
  fireEvent.drop(zone, { dataTransfer: { files: [file], types: ["Files"] } });
}

async function editWarmIdle(user: ReturnType<typeof userEvent.setup>, rpm: string) {
  const idle = screen.getByRole("textbox", { name: "Warm idle (rpm)" });
  await user.clear(idle);
  await user.type(idle, rpm);
  await user.tab();
}

/** The card of the module whose level 2 heading has this title. */
function moduleCard(title: string): HTMLElement {
  const card = screen
    .getByRole("heading", { level: 2, name: title })
    .closest<HTMLElement>('[data-slot="card"]');
  if (!card) throw new Error(`No module card for ${title}`);
  return card;
}

/** The button in a module's heading that collapses and expands it. */
function moduleToggle(title: string): HTMLElement {
  return screen.getByRole("button", { name: title });
}

/** Every button and field in a module, apart from the toggle in its heading. */
function controlsInModule(title: string): HTMLElement[] {
  const toggle = moduleToggle(title);
  return Array.from(
    moduleCard(title).querySelectorAll<HTMLElement>("button, input, select, textarea"),
  ).filter((control) => control !== toggle);
}

/** The tire fields of one group. Look them up again after a tune loads: the module redraws them. */
function tireGroup(name: string) {
  return within(screen.getByRole("group", { name }));
}

describe("tune editor", () => {
  it("asks for the chip serial before it opens a .hcf, then opens it", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile());
    expect(await screen.findByText(/Enter the chip serial to open tune\.hcf/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Chip serial"), SERIAL);

    expect(await screen.findByText(/^Editing/)).toHaveTextContent("Editing tune.hcf · Hydra .hcf");
    expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("38.0");
  });

  it("says when the serial does not match the file, and opens it once the serial is right", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText("Chip serial"), "FFFFFFFF");
    await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile());
    expect(
      await screen.findByText("The chip serial does not match this file."),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Chip serial"));
    await user.type(screen.getByLabelText("Chip serial"), SERIAL);

    expect(await screen.findByText(/^Editing/)).toHaveTextContent("tune.hcf");
    expect(screen.queryByText("The chip serial does not match this file.")).not.toBeInTheDocument();
  });

  it("converts between shift point and speedometer mph with the fitted tire size", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await setTire(user, "Tires on the truck", ["315", "75", "16"]);
    expect(curveInput("3→4 (overdrive)", "0%", "speedometer")).toHaveValue("41.4");

    const speedometer = curveInput("3→4 (overdrive)", "0%", "speedometer");
    await user.clear(speedometer);
    await user.type(speedometer, "40");

    // 40 mph on 34.60 in tires = 36.68 mph on 31.73 in tires; the tune stores 0.5 mph steps.
    expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("36.5");
  });

  it("updates the speedometer values when a size is chosen from the searchable list", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    const fitted = within(screen.getByRole("group", { name: "Tires on the truck" }));
    expect(
      fitted.getByRole("combobox", { name: "Tires on the truck LT235/85R16" }),
    ).toBeInTheDocument();

    await chooseTire(user, "Tires on the truck", "315/75", "315/75R16");

    expect(curveInput("3→4 (overdrive)", "0%", "speedometer")).toHaveValue("41.4");
    expect(fitted.getByRole("status", { name: "Diameter" })).toHaveTextContent("34.60 in");
    expect(
      fitted.getByRole("combobox", { name: "Tires on the truck 315/75R16" }),
    ).toBeInTheDocument();

    await chooseTire(user, "Tires on the truck", "lt235", /^LT235\/85R16/);

    expect(curveInput("3→4 (overdrive)", "0%", "speedometer")).toHaveValue("38.0");
    expect(fitted.getByRole("status", { name: "Diameter" })).toHaveTextContent("31.73 in");
  });

  it("works with a flotation size typed in, which names its own diameter", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await setTire(user, "Tires on the truck", ["12.50", "35", "17"]);

    const fitted = within(screen.getByRole("group", { name: "Tires on the truck" }));
    expect(fitted.getByRole("status", { name: "Diameter" })).toHaveTextContent("35.00 in");
    expect(screen.getByText(/35x12\.50R17 fitted/)).toBeInTheDocument();
    // 38.0 mph on the 31.73 in tires the tune is calibrated for is 41.9 mph on 35.00 in tires.
    expect(curveInput("3→4 (overdrive)", "0%", "speedometer")).toHaveValue("41.9");

    const speedometer = curveInput("3→4 (overdrive)", "0%", "speedometer");
    await user.clear(speedometer);
    await user.type(speedometer, "44");

    // 44 mph on 35.00 in tires = 39.89 mph on 31.73 in tires; the tune stores 0.5 mph steps.
    expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("40.0");
  });

  it("shows a flotation size chosen from the list in the Manual tab as its width, height and rim", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await chooseTire(user, "Tires on the truck", "35x12.50r17", "35x12.50R17");

    const fitted = within(screen.getByRole("group", { name: "Tires on the truck" }));
    expect(fitted.getByRole("status", { name: "Diameter" })).toHaveTextContent("35.00 in");
    await user.click(fitted.getByRole("tab", { name: "Manual tire size" }));
    expect(fitted.getByRole("textbox", { name: "Width" })).toHaveValue("12.50");
    expect(fitted.getByRole("textbox", { name: "Height" })).toHaveValue("35");
    expect(fitted.getByRole("textbox", { name: "Rim" })).toHaveValue("17");
  });

  it("ignores an implausible tire size while it is being entered", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await setTire(user, "Tires on the truck", ["31", "75", "16"]);

    // A width of 31 is too wide in inches and too narrow in millimetres, so it is no tire.
    expect(curveInput("3→4 (overdrive)", "0%", "speedometer")).toHaveValue("38.0");
    const fitted = within(screen.getByRole("group", { name: "Tires on the truck" }));
    expect(fitted.getByRole("textbox", { name: "Width" })).toHaveValue("235");
  });

  it("says what is wrong while the three numbers are not a size, and ignores them", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    const group = within(screen.getByRole("group", { name: "Tires on the truck" }));
    await user.click(group.getByRole("tab", { name: "Manual tire size" }));
    const width = group.getByRole("textbox", { name: "Width" });

    await user.clear(width);
    await user.type(width, "501");

    expect(group.getByText("These three numbers are not a tire size.")).toBeInTheDocument();
    expect(curveInput("3→4 (overdrive)", "0%", "speedometer")).toHaveValue("38.0");
  });

  it("moves the speedometer value one stored step per arrow key", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await setTire(user, "Tires on the truck", ["315", "75", "16"]);

    await user.click(curveInput("3→4 (overdrive)", "0%", "speedometer"));
    await user.keyboard("{ArrowUp}");

    // One stored step is 0.5 mph in the tune, 0.55 mph on the speedometer with 315/75R16 tires.
    expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("38.5");
  });

  it("warns when a downshift is above its upshift", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    expect(screen.queryByText("Possible gear hunting")).not.toBeInTheDocument();

    const downshift = curveInput("4→3 (out of overdrive)", "0%", "shift point");
    await user.clear(downshift);
    await user.type(downshift, "40");

    expect(await screen.findByText("Possible gear hunting")).toBeInTheDocument();
    expect(screen.getAllByText(/4→3 downshift above 3→4 upshift/).length).toBeGreaterThan(0);
  });

  it("sets every shift point for the fitted tires in one step", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await user.click(screen.getByRole("button", { name: /speedometer calibration/i }));
    await setTire(user, "Tire size the speedometer is calibrated for", ["265", "75", "16"]);
    await setTire(user, "Tires on the truck", ["315", "75", "16"]);
    await user.click(screen.getByRole("button", { name: "Set shift points for these tires" }));

    // The shipped -TIRECOMP-UPDOWN Daily Driver: 3→4 closed 38.0 -> 35.0, 4→3 closed 36.0 -> 33.0.
    expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("35.0");
    expect(curveInput("4→3 (out of overdrive)", "0%", "shift point")).toHaveValue("33.0");
  });

  it("sets every shift point for the fitted tires in one step, with both sizes chosen from the list", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await user.click(screen.getByRole("button", { name: /speedometer calibration/i }));
    await chooseTire(user, "Tire size the speedometer is calibrated for", "265/75", "265/75R16");
    await chooseTire(user, "Tires on the truck", "315/75", "315/75R16");
    await user.click(screen.getByRole("button", { name: "Set shift points for these tires" }));

    expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("35.0");
    expect(curveInput("4→3 (out of overdrive)", "0%", "shift point")).toHaveValue("33.0");
  });

  it("generates a .hcf for the chip that holds the edits and nothing else", async () => {
    const user = userEvent.setup();
    let written: Uint8Array | undefined;
    const picker = vi.fn(async () => ({
      name: "out.hcf",
      createWritable: async () => ({
        write: async (data: Uint8Array) => {
          written = data;
        },
        close: async () => {},
      }),
    }));
    (window as SaveDialogWindow).showSaveFilePicker = picker;
    renderEditor();
    await openTune(user);

    const idle = screen.getByRole("textbox", { name: "Warm idle (rpm)" });
    await user.clear(idle);
    await user.type(idle, "700");
    await user.click(screen.getByRole("button", { name: "Generate Tune" }));

    await waitFor(() => expect(written).toBeDefined());
    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: "tune-CUSTOM.hcf" }),
    );
    const image = new HcfCodec(SERIAL).decode(written as Uint8Array);
    expect(readTuneValues(image).warmIdleRaw).toEqual([2800, 2800]);
    // The baseline is the uploaded tune as decoded: a .hcf carries only the four banks, so the
    // 8 KiB gaps between them always decode to 0xFF.
    const uploaded = new HcfCodec(SERIAL).decode(new HcfCodec(SERIAL).encode(buildTde1Image()));
    // 680 rpm -> 700 rpm is 0x0AA0 -> 0x0AF0 in each little-endian idle word: only the low bytes.
    expect(changedOffsets(uploaded, image)).toEqual([0x124a6, 0x124aa]);
  });

  it("loads a PHP library tune through the server route, with no chip serial", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(efuBytes().slice(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor([STOCK_OPTION]);

    await user.click(screen.getByRole("tab", { name: "PHP public library" }));
    await user.click(screen.getByRole("option", { name: /Stock/ }));

    // A PHP library .efu uses a fixed key, so it opens without the chip serial.
    expect(await screen.findByText(/^Editing/)).toHaveTextContent(
      "Editing VCAB0_02_0S.efu · PHP library .efu",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/library/VCAB0_02_0S.efu");
  });

  it("asks for no chip serial on the library tab while a PHP tune is being chosen", async () => {
    const user = userEvent.setup();
    renderEditor([STOCK_OPTION]);

    await user.click(screen.getByRole("tab", { name: "PHP public library" }));

    expect(screen.getByRole("option", { name: /Stock/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Chip serial")).not.toBeInTheDocument();
  });

  it("asks for the chip serial on the library tab once a PHP tune is open, because Generate Tune writes a .hcf", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(efuBytes().slice(), { status: 200 })),
    );
    renderEditor([STOCK_OPTION]);
    await user.click(screen.getByRole("tab", { name: "PHP public library" }));
    await user.click(screen.getByRole("option", { name: /Stock/ }));
    await screen.findByText(/^Editing/);
    const generate = screen.getByRole("button", { name: "Generate Tune" });

    // aria-disabled keeps the button focusable; jest-dom's toBeDisabled checks only `disabled`.
    expect(generate).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Enter the 8-digit chip serial in Base Tune.")).toBeInTheDocument();
    const serial = within(moduleCard("Base Tune")).getByLabelText("Chip serial");
    expect(serial).toHaveAccessibleDescription(/Generate Tune needs it to write the \.hcf/);

    await user.type(serial, SERIAL);

    expect(generate).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows the route's error when a library tune cannot be downloaded", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Could not reach PHP's server." }, { status: 502 })),
    );
    renderEditor([STOCK_OPTION]);

    await user.click(screen.getByRole("tab", { name: "PHP public library" }));
    await user.click(screen.getByRole("option", { name: /Stock/ }));

    expect(
      await screen.findByText("Could not download VCAB0_02_0S.efu: Could not reach PHP's server."),
    ).toBeInTheDocument();
  });
});

describe("opening files safely", () => {
  it("refuses a file type it cannot read, without reading it", async () => {
    renderEditor();
    const file = new File(["hello"], "notes.txt");
    const read = vi.spyOn(file, "arrayBuffer");

    dropFile(file);

    expect(await screen.findByText("Choose a .hcf, .efu or .bin file.")).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
  });

  it("refuses a file too large to be a tune, without reading it", async () => {
    renderEditor();
    const file = new File([new Uint8Array(2_000_000)], "big.hcf");
    const read = vi.spyOn(file, "arrayBuffer");

    dropFile(file);

    expect(
      await screen.findByText("big.hcf is too large to be a tune file (2,000,000 bytes)."),
    ).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
  });

  it("says when a file cannot be read, and then still opens another", async () => {
    const user = userEvent.setup();
    renderEditor();
    const unreadable = new File([buildTde1Image().slice()], "tune.bin");
    vi.spyOn(unreadable, "arrayBuffer").mockRejectedValue(
      new DOMException("The file could not be read.", "NotReadableError"),
    );

    dropFile(unreadable);

    expect(await screen.findByText("Could not read tune.bin.")).toBeInTheDocument();
    expect(screen.getByLabelText(/drop a file here/i)).toBeEnabled();
    await user.upload(
      screen.getByLabelText(/drop a file here/i),
      new File([buildTde1Image().slice()], "good.bin"),
    );
    expect(await screen.findByText(/^Editing/)).toHaveTextContent("good.bin");
  });
});

describe("saving", () => {
  it("builds the .hcf before it opens the save dialog", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const encode = HcfCodec.prototype.encode;
    vi.spyOn(HcfCodec.prototype, "encode").mockImplementation(function (
      this: HcfCodec,
      image: Uint8Array,
    ) {
      order.push("build");
      return encode.call(this, image);
    });
    (window as SaveDialogWindow).showSaveFilePicker = vi.fn(async () => {
      order.push("dialog");
      return {
        name: "out.hcf",
        createWritable: async () => ({
          write: async () => {},
          close: async () => {},
          abort: async () => {},
        }),
      };
    });
    renderEditor();
    await openTune(user);
    order.length = 0;

    await user.click(screen.getByRole("button", { name: "Generate Tune" }));

    await waitFor(() => expect(order).toEqual(["build", "dialog"]));
  });
});

describe("unsaved changes", () => {
  it("asks before another tune replaces the changes, and keeps them when told to", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await editWarmIdle(user, "700");

    await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile("other.hcf"));
    const dialog = await screen.findByRole("alertdialog", { name: "Discard your changes?" });
    expect(dialog).toHaveTextContent("Opening other.hcf replaces the tune you are editing.");
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));

    expect(screen.getByText(/^Editing/)).toHaveTextContent("tune.hcf");
    expect(screen.getByRole("textbox", { name: "Warm idle (rpm)" })).toHaveValue("700");

    await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile("other.hcf"));
    const again = await screen.findByRole("alertdialog", { name: "Discard your changes?" });
    await user.click(within(again).getByRole("button", { name: "Discard changes" }));

    expect(await screen.findByText(/^Editing/)).toHaveTextContent("other.hcf");
    expect(screen.getByRole("textbox", { name: "Warm idle (rpm)" })).toHaveValue("680");
  });

  it("opens another tune without asking when nothing changed", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile("other.hcf"));

    await waitFor(() => expect(screen.getByText(/^Editing/)).toHaveTextContent("other.hcf"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks before Reset all changes", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await editWarmIdle(user, "700");

    await user.click(screen.getByRole("button", { name: "Reset all changes" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Discard your changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));

    expect(screen.getByRole("textbox", { name: "Warm idle (rpm)" })).toHaveValue("680");
  });

  it("asks before tire compensation replaces edited shift points", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    const wot = curveInput("3→4 (overdrive)", "100%", "shift point");
    await user.clear(wot);
    await user.type(wot, "60");
    await setTire(user, "Tires on the truck", ["315", "75", "16"]);

    await user.click(screen.getByRole("button", { name: "Set shift points for these tires" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Discard your changes?" });
    expect(dialog).toHaveTextContent("replaces the shift points you changed");
    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));

    // 38.0 mph x 31.73 / 34.60 = 34.8 mph, stored in 0.5 mph steps.
    expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("35.0");
  });
});

describe("page modules", () => {
  describe("titles and order", () => {
    it("titles the tune source module Base Tune, not Starting tune", () => {
      renderEditor();

      expect(screen.getByRole("heading", { level: 2, name: "Base Tune" })).toBeInTheDocument();
      expect(screen.queryByText(/starting tune/i)).not.toBeInTheDocument();
    });

    it("puts the chip serial field on the upload tab of Base Tune, above the drop zone", () => {
      renderEditor();
      const baseTune = within(moduleCard("Base Tune"));
      const serial = baseTune.getByLabelText("Chip serial");

      expect(serial.compareDocumentPosition(baseTune.getByLabelText(/drop a file here/i))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(screen.queryByRole("heading", { level: 2, name: "Chip" })).not.toBeInTheDocument();
      expect(within(moduleCard("Tires")).queryByLabelText("Chip serial")).not.toBeInTheDocument();
    });

    it("opens every module at the start", () => {
      renderEditor();

      for (const title of ["Base Tune", "Idle", "Tires", "Shiftpoints"]) {
        expect(moduleToggle(title)).toHaveAttribute("aria-expanded", "true");
      }
    });

    it("shows the modules as level 2 headings, and the schedule headings below Shiftpoints", async () => {
      const user = userEvent.setup();
      renderEditor();
      await openTune(user);

      const headings = (level: number) =>
        screen.getAllByRole("heading", { level }).map((heading) => heading.textContent);

      expect(headings(2)).toEqual(["Base Tune", "Idle", "Tires", "Shiftpoints"]);
      expect(headings(3)).toEqual(["Upshifts", "Downshifts"]);
      expect(headings(4)).toEqual([
        "1→2",
        "2→3",
        "3→4 (overdrive)",
        "2→1",
        "3→2",
        "4→3 (out of overdrive)",
      ]);
    });

    it("lists each shift curve from closed throttle at the top to wide open at the bottom", async () => {
      const user = userEvent.setup();
      renderEditor();
      await openTune(user);
      const shiftPoints = screen.getAllByRole("textbox", { name: /^1→2, .* shift point \(mph\)$/ });
      const table = shiftPoints[0]?.closest("table");
      if (!table) throw new Error("No table around the 1→2 shift points");

      expect(
        within(table)
          .getAllByRole("rowheader")
          .map((cell) => cell.textContent),
      ).toEqual(["Closed", "20%", "29%", "49%", "66% step", "66%", "WOT"]);
      expect(shiftPoints.map((input) => (input as HTMLInputElement).value)).toEqual([
        "7.0",
        "7.0",
        "9.0",
        "14.0",
        "21.0",
        "27.0",
        "27.0",
      ]);
    });
  });

  describe("before a tune is loaded", () => {
    it("shows a No tune loaded notice in Tires, and none of its fields, until a tune is loaded", async () => {
      const user = userEvent.setup();
      renderEditor();
      const tires = () => within(moduleCard("Tires"));

      expect(tires().getByText("No tune loaded")).toBeInTheDocument();
      expect(tires().getByText(TIRES_NO_TUNE_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Tires on the truck" })).not.toBeInTheDocument();
      expect(tires().queryByText(/^Speedometer mph =/)).not.toBeInTheDocument();
      expect(controlsInModule("Tires")).toEqual([]);

      await openTune(user);

      expect(tires().queryByText("No tune loaded")).not.toBeInTheDocument();
      const fitted = tireGroup("Tires on the truck");
      expect(fitted.getByRole("combobox", { name: /^Tires on the truck/ })).toBeEnabled();
      expect(fitted.getByRole("tab", { name: "Manual tire size" })).toBeEnabled();
      expect(tires().getByRole("button", { name: /speedometer calibration/i })).toBeEnabled();
    });

    it("collapses Tires to No tune loaded until a tune is loaded", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(moduleToggle("Tires"));

      expect(screen.queryByText(TIRES_NO_TUNE_MESSAGE)).not.toBeInTheDocument();
      expect(within(moduleCard("Tires")).getByText("No tune loaded")).toBeInTheDocument();
    });

    it("tells what to do in Idle and Shiftpoints until a tune is loaded", async () => {
      const user = userEvent.setup();
      renderEditor();
      const noTuneIdle = "Load a base tune to edit the idle speed.";
      const noTuneSchedule =
        "Upload a .hcf or pick a PHP library tune to see its shift points and idle speed.";

      expect(within(moduleCard("Idle")).getByText(noTuneIdle)).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Warm idle (rpm)" })).not.toBeInTheDocument();
      expect(within(moduleCard("Shiftpoints")).getByText(noTuneSchedule)).toBeInTheDocument();

      await openTune(user);

      expect(screen.queryByText(noTuneIdle)).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Warm idle (rpm)" })).toHaveValue("680");
      expect(screen.queryByText(noTuneSchedule)).not.toBeInTheDocument();
    });

    it("shows No tune loaded in the collapsed Base Tune, Idle and Shiftpoints modules", async () => {
      const user = userEvent.setup();
      renderEditor();

      for (const title of ["Base Tune", "Idle", "Shiftpoints"]) {
        await user.click(moduleToggle(title));

        expect(within(moduleCard(title)).getByText("No tune loaded")).toBeInTheDocument();
      }
    });
  });

  describe("shift point help", () => {
    it("puts a question mark button right after the Shiftpoints title, before a tune is loaded too", () => {
      renderEditor();
      const shiftpoints = within(moduleCard("Shiftpoints"));
      const heading = shiftpoints.getByRole("heading", { level: 2, name: "Shiftpoints" });
      const help = shiftpoints.getByRole("button", { name: "About shift points" });

      expect(heading.compareDocumentPosition(help)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(help.closest('[data-slot="card-title"]')).not.toBeNull();
      expect(help).toHaveAttribute("aria-expanded", "false");
    });

    it("opens a popover with the explanation word for word, and no paragraph of it stays on the page", async () => {
      const user = userEvent.setup();
      renderEditor();
      await openTune(user);
      const explanation = /Shift point is the speed stored in the tune/;
      expect(screen.queryByText(explanation)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "About shift points" }));

      const popover = await screen.findByRole("dialog", { name: "About shift points" });
      expect(within(popover).getByText(SHIFT_POINTS_HELP)).toBeInTheDocument();
      expect(screen.getAllByText(explanation)).toHaveLength(1);
      expect(moduleToggle("Shiftpoints")).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("collapsing", () => {
    it("collapses Base Tune to the file, its format and the chip serial, and expands it back to the source tabs", async () => {
      const user = userEvent.setup();
      renderEditor();
      await openTune(user);
      const summary = `tune.hcf · Hydra .hcf · chip serial ${SERIAL}`;

      await user.click(moduleToggle("Base Tune"));

      expect(screen.queryByLabelText(/drop a file here/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Chip serial")).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Upload a file" })).not.toBeInTheDocument();
      expect(within(moduleCard("Base Tune")).getByText(summary)).toBeInTheDocument();
      expect(screen.queryByText(/^Editing/)).not.toBeInTheDocument();

      await user.click(moduleToggle("Base Tune"));

      expect(screen.getByLabelText(/drop a file here/i)).toBeInTheDocument();
      expect(screen.getByLabelText("Chip serial")).toHaveValue(SERIAL);
      expect(within(moduleCard("Base Tune")).getByText(/^Editing/)).toHaveTextContent(
        "Editing tune.hcf · Hydra .hcf",
      );
      expect(within(moduleCard("Base Tune")).queryByText(summary)).not.toBeInTheDocument();
    });

    it("leaves the chip serial out of the collapsed Base Tune while none is entered", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(moduleToggle("Base Tune"));

      expect(within(moduleCard("Base Tune")).getByText("No tune loaded")).toBeInTheDocument();
    });

    it("shows the open tune inside the Base Tune module, not between the modules", async () => {
      const user = userEvent.setup();
      renderEditor();
      await openTune(user);

      const editing = screen.getByText(/^Editing/);

      expect(editing.closest('[data-slot="card"]')).toBe(moduleCard("Base Tune"));
      expect(editing).toHaveTextContent("Editing tune.hcf · Hydra .hcf");
    });

    it("collapses Tires to the fitted tires and the speedometer factor, and expands it back to the fields", async () => {
      const user = userEvent.setup();
      renderEditor();
      await openTune(user);
      await setTire(user, "Tires on the truck", ["315", "75", "16"]);

      await user.click(moduleToggle("Tires"));

      expect(screen.queryByRole("group", { name: "Tires on the truck" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Set shift points for these tires" }),
      ).not.toBeInTheDocument();
      expect(
        within(moduleCard("Tires")).getByText(
          "315/75R16 · 34.60 in · calibrated for 235/85R16 · speedometer × 1.0906",
        ),
      ).toBeInTheDocument();

      await user.click(moduleToggle("Tires"));

      const fitted = tireGroup("Tires on the truck");
      expect(
        fitted.getByRole("combobox", { name: "Tires on the truck 315/75R16" }),
      ).toBeInTheDocument();
      expect(fitted.getByRole("status", { name: "Diameter" })).toHaveTextContent("34.60 in");
      expect(curveInput("3→4 (overdrive)", "0%", "speedometer")).toHaveValue("41.4");
    });

    it("collapses Shiftpoints to the closed-throttle and wide-open points, and expands it back to the fields", async () => {
      const user = userEvent.setup();
      renderEditor();
      await openTune(user);
      const closedShiftPoint = curveInput("3→4 (overdrive)", "0%", "shift point");
      await user.clear(closedShiftPoint);
      await user.type(closedShiftPoint, "40");

      await user.click(moduleToggle("Shiftpoints"));

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("textbox", { name: /shift point \(mph\)/ }),
      ).not.toBeInTheDocument();
      expect(
        within(moduleCard("Shiftpoints")).getByText(
          "1→2 7–27 · 2→3 18–43 · 3→4 40–64.5 · 2→1 5.5–21 · 3→2 17.5–37 · 4→3 36–63 · 1 changed",
        ),
      ).toBeInTheDocument();

      await user.click(moduleToggle("Shiftpoints"));

      expect(screen.getAllByRole("table")).toHaveLength(6);
      expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("40.0");
      expect(screen.getByText("was 38.0")).toBeInTheDocument();
    });

    it("collapses Idle to the warm idle, and expands it back to the field with the idle in it", async () => {
      const user = userEvent.setup();
      renderEditor();
      await openTune(user);

      await user.click(moduleToggle("Idle"));

      expect(screen.queryByRole("textbox", { name: "Warm idle (rpm)" })).not.toBeInTheDocument();
      expect(within(moduleCard("Idle")).getByText("680 rpm")).toBeInTheDocument();

      await user.click(moduleToggle("Idle"));
      await editWarmIdle(user, "700");
      await user.click(moduleToggle("Idle"));

      expect(within(moduleCard("Idle")).getByText("700 rpm")).toBeInTheDocument();

      await user.click(moduleToggle("Idle"));

      expect(screen.getByRole("textbox", { name: "Warm idle (rpm)" })).toHaveValue("700");
      expect(screen.getByText("was 680")).toBeInTheDocument();
    });

    it("keeps the alerts outside the modules, so collapsing a module hides none", async () => {
      const user = userEvent.setup();
      renderEditor();
      await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile());
      const needsSerial = await screen.findByText(/Enter the chip serial to open tune\.hcf/);
      expect(needsSerial.closest('[data-slot="card"]')).toBeNull();

      await user.click(moduleToggle("Base Tune"));

      expect(screen.getByText(/Enter the chip serial to open tune\.hcf/)).toBeVisible();

      await user.click(moduleToggle("Base Tune"));
      await user.type(screen.getByLabelText("Chip serial"), SERIAL);
      await user.click(moduleToggle("Base Tune"));

      expect(
        await within(moduleCard("Base Tune")).findByText(
          `tune.hcf · Hydra .hcf · chip serial ${SERIAL}`,
        ),
      ).toBeVisible();
      expect(screen.queryByText(/Enter the chip serial/)).not.toBeInTheDocument();
    });
  });
});
