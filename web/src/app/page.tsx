import { Suspense } from "react";

import { BaseTuneModule } from "@/features/tune-editor/sections/base-tune-module";
import { ConverterLockupModule } from "@/features/tune-editor/sections/converter-lockup-module";
import { GenerateSection } from "@/features/tune-editor/sections/generate-section";
import { IdleModule } from "@/features/tune-editor/sections/idle-module";
import { LibraryTunes, LibraryTunesFallback } from "@/features/tune-editor/sections/library-tunes";
import { ShiftPointsModule } from "@/features/tune-editor/sections/shift-points-module";
import { ShiftFirmnessModule } from "@/features/tune-editor/sections/shift-firmness-module";
import { TiresModule } from "@/features/tune-editor/sections/tires-module";
import { TuneStatus } from "@/features/tune-editor/sections/tune-status";
import { UploadSection } from "@/features/tune-editor/sections/upload-section";
import { TuneEditorProvider } from "@/features/tune-editor/tune-editor-provider";

export default function TuneEditorPage() {
  return (
    <TuneEditorProvider>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <BaseTuneModule
              upload={<UploadSection />}
              library={
                <Suspense fallback={<LibraryTunesFallback />}>
                  <LibraryTunes />
                </Suspense>
              }
            />
            <TuneStatus />
            <IdleModule />
          </div>
          <TiresModule />
        </div>
        <ShiftPointsModule />
        <ConverterLockupModule />
        <ShiftFirmnessModule />
      </main>
      <section
        aria-label="Generate tune"
        className="sticky bottom-0 z-10 border-t bg-background/90 backdrop-blur"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
          <GenerateSection />
        </div>
      </section>
    </TuneEditorProvider>
  );
}
