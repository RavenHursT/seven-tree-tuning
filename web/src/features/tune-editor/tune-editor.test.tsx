import { assertOnlyEditableChanges, Blowfish, HcfCodec, readTuneValues } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import type { LibraryTuneOption } from "./components/library-tune-picker";
import { GenerateSection } from "./sections/generate-section";
import { IdleSection } from "./sections/idle-section";
import { LibrarySection } from "./sections/library-section";
import { ScheduleSection } from "./sections/schedule-section";
import { SettingsSection } from "./sections/settings-section";
import { TuneStatus } from "./sections/tune-status";
import { UploadSection } from "./sections/upload-section";
import { TuneEditorProvider } from "./tune-editor-provider";

const SERIAL = "0A1B2C3D";
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

function renderEditor(tunes: LibraryTuneOption[] = []) {
  return render(
    <TooltipProvider>
      <TuneEditorProvider>
        <UploadSection />
        <LibrarySection tunes={tunes} sourceUrl="https://gopowerhungry.com/pages/hydra-chip" />
        <TuneStatus />
        <SettingsSection />
        <ScheduleSection />
        <IdleSection />
        <GenerateSection />
      </TuneEditorProvider>
    </TooltipProvider>,
  );
}

function curveInput(title: string, throttle: string, column: "shift point" | "speedometer") {
  return screen.getByRole("textbox", { name: `${title}, ${throttle} throttle, ${column} (mph)` });
}

async function setTire(
  user: ReturnType<typeof userEvent.setup>,
  group: string,
  widthMm: string,
  aspect: string,
) {
  const fields = within(screen.getByRole("group", { name: group }));
  await user.clear(fields.getByLabelText("Width (mm)"));
  await user.type(fields.getByLabelText("Width (mm)"), widthMm);
  await user.clear(fields.getByLabelText("Aspect (%)"));
  await user.type(fields.getByLabelText("Aspect (%)"), aspect);
  await user.tab();
}

async function openTune(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Chip serial"), SERIAL);
  await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile());
  await screen.findByText(/^Editing/);
}

afterEach(() => {
  delete (window as SaveDialogWindow).showSaveFilePicker;
  vi.unstubAllGlobals();
});

describe("tune editor", () => {
  it("asks for the chip serial before it opens a .hcf, then opens it", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.upload(screen.getByLabelText(/drop a file here/i), hcfFile());
    expect(await screen.findByText(/Enter the chip serial to open tune\.hcf/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Chip serial"), SERIAL);

    expect(await screen.findByText(/^Editing/)).toHaveTextContent("tune.hcf");
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

    await setTire(user, "Tires on the truck", "315", "75");
    expect(curveInput("3→4 (overdrive)", "0%", "speedometer")).toHaveValue("41.4");

    const speedometer = curveInput("3→4 (overdrive)", "0%", "speedometer");
    await user.clear(speedometer);
    await user.type(speedometer, "40");

    // 40 mph on 34.60 in tires = 36.68 mph on 31.73 in tires; the tune stores 0.5 mph steps.
    expect(curveInput("3→4 (overdrive)", "0%", "shift point")).toHaveValue("36.5");
  });

  it("warns when a downshift reaches its upshift", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    expect(screen.queryByText("Possible gear hunting")).not.toBeInTheDocument();

    const downshift = curveInput("4→3 (out of overdrive)", "0%", "shift point");
    await user.clear(downshift);
    await user.type(downshift, "40");

    expect(await screen.findByText("Possible gear hunting")).toBeInTheDocument();
    expect(screen.getAllByText(/4→3 downshift at or above 3→4 upshift/).length).toBeGreaterThan(0);
  });

  it("sets every shift point for the fitted tires in one step", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await user.click(screen.getByRole("button", { name: /speedometer calibration/i }));
    await setTire(user, "Tire size the speedometer is calibrated for", "265", "75");
    await setTire(user, "Tires on the truck", "315", "75");
    await user.click(screen.getByRole("button", { name: "Set shift points for these tires" }));

    // The shipped -TIRECOMP-UPDOWN Daily Driver: 3→4 closed 38.0 -> 35.0, 4→3 closed 36.0 -> 33.0.
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
    expect(() => assertOnlyEditableChanges(uploaded, image)).not.toThrow();
  });

  it("loads a PHP library tune through the server route", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(efuBytes().slice(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor([STOCK_OPTION]);

    await user.click(screen.getByRole("option", { name: /Stock/ }));

    expect(await screen.findByText(/^Editing/)).toHaveTextContent("VCAB0_02_0S.efu");
    expect(fetchMock).toHaveBeenCalledWith("/api/library/VCAB0_02_0S.efu");
    expect(screen.getByRole("button", { name: "Generate Tune" })).toBeDisabled();
    expect(screen.getByText("Enter the 8-digit chip serial.")).toBeInTheDocument();
  });

  it("shows the route's error when a library tune cannot be downloaded", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Could not reach PHP's server." }, { status: 502 })),
    );
    renderEditor([STOCK_OPTION]);

    await user.click(screen.getByRole("option", { name: /Stock/ }));

    expect(
      await screen.findByText("Could not download VCAB0_02_0S.efu: Could not reach PHP's server."),
    ).toBeInTheDocument();
  });
});
