import { changedOffsets, HcfCodec, readTuneValues } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BaseTuneModule } from "./sections/base-tune-module";
import { ConverterLockupModule } from "./sections/converter-lockup-module";
import { GenerateSection } from "./sections/generate-section";
import { LibrarySection } from "./sections/library-section";
import { ShiftFirmnessModule } from "./sections/shift-firmness-module";
import { TiresModule } from "./sections/tires-module";
import { UploadSection } from "./sections/upload-section";
import { TuneEditorProvider } from "./tune-editor-provider";

const SERIAL = "0A1B2C3D";

type SaveDialogWindow = Window & { showSaveFilePicker?: unknown };
type User = ReturnType<typeof userEvent.setup>;

function hcfFile(): File {
  const bytes = new HcfCodec(SERIAL).encode(buildTde1Image());
  return new File([bytes.slice()], "tune.hcf", { type: "application/octet-stream" });
}

function renderEditor() {
  return render(
    <TuneEditorProvider>
      <BaseTuneModule
        upload={<UploadSection />}
        library={
          <LibrarySection tunes={[]} sourceUrl="https://gopowerhungry.com/pages/hydra-chip" />
        }
      />
      <TiresModule />
      <ConverterLockupModule />
      <ShiftFirmnessModule />
      <GenerateSection />
    </TuneEditorProvider>,
  );
}

async function openTune(user: User) {
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

function moduleToggle(title: string): HTMLElement {
  return screen.getByRole("button", { name: title });
}

async function replaceText(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  await user.type(field, text);
}

function lockField(curve: string, pedal: string, column: string) {
  return screen.getByRole("textbox", { name: `${curve}, ${pedal}, ${column} (mph)` });
}

function adderField(curve: string, pedal: string) {
  return screen.getByRole("textbox", { name: `${curve}, ${pedal}, adder (PCM units)` });
}

afterEach(() => {
  delete (window as SaveDialogWindow).showSaveFilePicker;
  vi.restoreAllMocks();
});

describe("before a tune is loaded", () => {
  it("shows No tune loaded in both modules, open, and in their collapsed summaries", async () => {
    const user = userEvent.setup();
    renderEditor();

    for (const title of ["Converter lockup", "Shift firmness"]) {
      expect(moduleToggle(title)).toHaveAttribute("aria-expanded", "true");
      expect(within(moduleCard(title)).getByText("No tune loaded")).toBeInTheDocument();
      await user.click(moduleToggle(title));
      expect(within(moduleCard(title)).getByText("No tune loaded")).toBeInTheDocument();
    }
  });
});

describe("Converter lockup", () => {
  it("shows a lock and an unlock curve for each of 2nd, 3rd and 4th gear", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    const tables = within(moduleCard("Converter lockup")).getAllByRole("table");

    expect(tables.map((table) => table.getAttribute("aria-label"))).toEqual([
      "2nd gear lock",
      "2nd gear unlock",
      "3rd gear lock",
      "3rd gear unlock",
      "4th gear lock",
      "4th gear unlock",
    ]);
    expect(lockField("4th gear lock", "100% pedal", "lock speed")).toHaveValue("30.0");
    expect(lockField("4th gear unlock", "0% pedal", "unlock speed")).toHaveValue("28.0");
    expect(lockField("2nd gear lock", "0% pedal", "lock speed")).toHaveValue("never");
  });

  it("changes the speedometer speed with the tires, and each field edits the other", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await replaceText(user, lockField("4th gear lock", "100% pedal", "speedometer"), "33");

    // The tires are the factory tires, so stored and speedometer speeds are the same.
    expect(lockField("4th gear lock", "100% pedal", "lock speed")).toHaveValue("33.0");
    expect(screen.getByText("was 30.0")).toBeInTheDocument();
    expect(screen.getByText("1 lockup speed changed")).toBeInTheDocument();
  });

  it("sets never with the Never button and puts the value back with Reset", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await user.click(
      screen.getByRole("button", { name: "3rd gear lock, 100% pedal, set to never" }),
    );

    expect(lockField("3rd gear lock", "100% pedal", "lock speed")).toHaveValue("never");
    expect(screen.getByText("was 31.0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset 3rd gear lock" }));

    expect(lockField("3rd gear lock", "100% pedal", "lock speed")).toHaveValue("31.0");
    expect(screen.getByText("No changes")).toBeInTheDocument();
  });

  it("warns while an unlock speed is at or above its lock speed, and stops when it is not", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    const lockup = within(moduleCard("Converter lockup"));
    expect(lockup.queryByText("Possible converter cycling")).not.toBeInTheDocument();

    await replaceText(user, lockField("4th gear unlock", "100% pedal", "unlock speed"), "35");
    await replaceText(user, lockField("4th gear unlock", "0% pedal", "unlock speed"), "35");

    expect(lockup.getByText("Possible converter cycling")).toBeInTheDocument();
    expect(lockup.getByText("4th gear unlocks at or above its lock speed")).toBeInTheDocument();

    await replaceText(user, lockField("4th gear unlock", "100% pedal", "unlock speed"), "28");
    await replaceText(user, lockField("4th gear unlock", "0% pedal", "unlock speed"), "28");

    expect(lockup.queryByText("Possible converter cycling")).not.toBeInTheDocument();
  });

  it("shows an unlock speed of 127 mph as a number with a note, and no cycling warning", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    const lockup = within(moduleCard("Converter lockup"));
    expect(
      screen.queryByRole("button", { name: /4th gear unlock, .* set to never/ }),
    ).not.toBeInTheDocument();

    await replaceText(user, lockField("4th gear unlock", "100% pedal", "unlock speed"), "127");
    await replaceText(user, lockField("4th gear unlock", "0% pedal", "unlock speed"), "127");

    expect(lockField("4th gear unlock", "100% pedal", "unlock speed")).toHaveValue("127.0");
    expect(lockup.getAllByText("converter cannot stay locked here")).toHaveLength(2);
    expect(lockup.queryByText("Possible converter cycling")).not.toBeInTheDocument();
  });

  it("keeps its edits and shows them in the collapsed summary", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await replaceText(user, lockField("4th gear lock", "100% pedal", "lock speed"), "33");

    await user.click(moduleToggle("Converter lockup"));

    expect(
      within(moduleCard("Converter lockup")).getByText(
        "4th 30–33/28 · 3rd 27–31/17 · 2nd never–32/15 · 1 changed",
      ),
    ).toBeInTheDocument();

    await user.click(moduleToggle("Converter lockup"));

    expect(lockField("4th gear lock", "100% pedal", "lock speed")).toHaveValue("33.0");
  });

  it("opens a popover that explains lock, unlock and never", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "About converter lockup" }));

    const popover = await screen.findByRole("dialog", { name: "About converter lockup" });
    expect(
      within(popover).getByText(/A lock speed of 127 mph is shown as never/),
    ).toBeInTheDocument();
  });
});

describe("Shift firmness", () => {
  it("shows the three upshift adders with the stored signed values", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    const tables = within(moduleCard("Shift firmness")).getAllByRole("table");

    expect(tables.map((table) => table.getAttribute("aria-label"))).toEqual([
      "1→2 line pressure",
      "2→3 line pressure",
      "3→4 line pressure",
    ]);
    expect(adderField("3→4 line pressure", "100% pedal")).toHaveValue("38");
    expect(adderField("3→4 line pressure", "0% pedal")).toHaveValue("28");
  });

  it("marks a change, counts it, and puts it back with Reset", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await replaceText(user, adderField("2→3 line pressure", "100% pedal"), "20");

    expect(screen.getByText("was 14")).toBeInTheDocument();
    expect(screen.getByText("1 firmness value changed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset 2→3 line pressure" }));

    expect(adderField("2→3 line pressure", "100% pedal")).toHaveValue("14");
    expect(screen.getByText("No changes")).toBeInTheDocument();
  });

  it("accepts a negative value and refuses one outside the range of the byte", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    const field = adderField("1→2 line pressure", "100% pedal");

    await replaceText(user, field, "-20");
    expect(field).toHaveValue("-20");

    await replaceText(user, field, "200");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a number from -128 to 127.")).toBeInTheDocument();
  });

  it("shows the closed and wide-open values in the collapsed summary", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);

    await user.click(moduleToggle("Shift firmness"));

    expect(
      within(moduleCard("Shift firmness")).getByText("1→2 10–18 · 2→3 10–14 · 3→4 28–38"),
    ).toBeInTheDocument();
  });

  it("opens a popover that says higher is a firmer shift", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "About shift firmness" }));

    const popover = await screen.findByRole("dialog", { name: "About shift firmness" });
    expect(within(popover).getByText(/line-pressure adder \(PCM units\)/)).toBeInTheDocument();
    expect(within(popover).getByText(/Higher is a firmer shift/)).toBeInTheDocument();
  });
});

describe("Reset all changes", () => {
  it("puts back lockup speeds and firmness values too", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await replaceText(user, lockField("4th gear lock", "100% pedal", "lock speed"), "33");
    await replaceText(user, adderField("3→4 line pressure", "100% pedal"), "45");
    expect(
      screen.getByText("1 lockup speed changed · 1 firmness value changed"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset all changes" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Discard your changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));

    expect(lockField("4th gear lock", "100% pedal", "lock speed")).toHaveValue("30.0");
    expect(adderField("3→4 line pressure", "100% pedal")).toHaveValue("38");
    expect(screen.getByText("No changes")).toBeInTheDocument();
  });
});

describe("Set shift points for these tires", () => {
  it("keeps the lockup speeds and firmness values that were edited", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTune(user);
    await replaceText(user, lockField("4th gear lock", "100% pedal", "lock speed"), "33");
    await replaceText(user, adderField("3→4 line pressure", "100% pedal"), "45");

    await user.click(screen.getByRole("button", { name: /speedometer calibration/i }));
    await user.click(screen.getByRole("button", { name: "Set shift points for these tires" }));

    // Tire compensation changes shift speeds only, so it needs no confirmation here.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(lockField("4th gear lock", "100% pedal", "lock speed")).toHaveValue("33.0");
    expect(adderField("3→4 line pressure", "100% pedal")).toHaveValue("45");
  });
});

describe("Generate Tune", () => {
  it("writes an edited lockup speed and an edited firmness value, and no other byte", async () => {
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

    await replaceText(user, lockField("4th gear lock", "100% pedal", "lock speed"), "33");
    await replaceText(user, adderField("3→4 line pressure", "100% pedal"), "45");
    await user.click(screen.getByRole("button", { name: "Generate Tune" }));

    await waitFor(() => expect(written).toBeDefined());
    const image = new HcfCodec(SERIAL).decode(written as Uint8Array);
    const uploaded = new HcfCodec(SERIAL).decode(new HcfCodec(SERIAL).encode(buildTde1Image()));
    // The y byte of the first pair of 4th gear lock (0x146b4 + 1) and of 3→4 line pressure
    // (0x14860 + 1): mph x 2 = 66, and the signed adder 45.
    expect(changedOffsets(uploaded, image)).toEqual([0x146b5, 0x14861]);
    expect(image[0x146b5]).toBe(66);
    expect(image[0x14861]).toBe(45);
    expect(readTuneValues(image).lockupSpeedsRaw["lock-4"]).toEqual([66, 60, 60, 60]);
  });
});
