import { Suspense } from "react";

import { TuneSourcePanel } from "@/features/tune-editor/components/tune-source-panel";
import { GenerateSection } from "@/features/tune-editor/sections/generate-section";
import { IdleSection } from "@/features/tune-editor/sections/idle-section";
import { LibraryTunes, LibraryTunesFallback } from "@/features/tune-editor/sections/library-tunes";
import { ScheduleSection } from "@/features/tune-editor/sections/schedule-section";
import { SettingsSection } from "@/features/tune-editor/sections/settings-section";
import { TuneStatus } from "@/features/tune-editor/sections/tune-status";
import { UploadSection } from "@/features/tune-editor/sections/upload-section";
import { TuneEditorProvider } from "@/features/tune-editor/tune-editor-provider";

export default function TuneEditorPage() {
  return (
    <TuneEditorProvider>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <TuneSourcePanel
              upload={<UploadSection />}
              library={
                <Suspense fallback={<LibraryTunesFallback />}>
                  <LibraryTunes />
                </Suspense>
              }
            />
            <TuneStatus />
            <IdleSection />
          </div>
          <SettingsSection />
        </div>
        <ScheduleSection />
      </main>
      <div className="sticky bottom-0 z-10 border-t bg-background/90 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
          <GenerateSection />
        </div>
      </div>
    </TuneEditorProvider>
  );
}
