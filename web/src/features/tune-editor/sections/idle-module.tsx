"use client";

import { CollapsibleModule } from "@/components/layout/collapsible-module";

import { IdleRpmField } from "../components/idle-rpm-field";
import { selectIdleView } from "../state/editor-selectors";
import { summarizeIdle } from "../state/module-summaries";
import { useTuneEditor } from "../tune-editor-provider";

/** Power Hungry's library idles from 525 rpm (Whisper Mode) to 1,200 rpm (High Idle). */
const IDLE_RPM_MIN = 500;
const IDLE_RPM_MAX = 1500;

/** The warm idle speed of the loaded tune. */
export function IdleModule() {
  const { state, dispatch } = useTuneEditor();
  const view = selectIdleView(state);

  return (
    <CollapsibleModule id="idle" title="Idle" summary={summarizeIdle(state)}>
      {view ? (
        <IdleRpmField
          rpm={view.rpm}
          originalRpm={view.originalRpm}
          onRpmChange={(rpm) => dispatch({ type: "warmIdleChanged", rpm })}
          min={IDLE_RPM_MIN}
          max={IDLE_RPM_MAX}
          warning={view.warning}
          idleCurve={view.idleCurve}
        />
      ) : (
        <p className="text-muted-foreground">Load a base tune to edit the idle speed.</p>
      )}
    </CollapsibleModule>
  );
}
