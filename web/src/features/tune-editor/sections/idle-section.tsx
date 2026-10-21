"use client";

import { IdleRpmField } from "../components/idle-rpm-field";
import { selectIdleView } from "../state/editor-selectors";
import { useTuneEditor } from "../tune-editor-provider";

/** Power Hungry's own idle tunes stay within 650 to 1,200 rpm; allow some room either side. */
const IDLE_RPM_MIN = 500;
const IDLE_RPM_MAX = 1500;

export function IdleSection() {
  const { state, dispatch } = useTuneEditor();
  const view = selectIdleView(state);
  if (!view) return null;

  return (
    <IdleRpmField
      rpm={view.rpm}
      originalRpm={view.originalRpm}
      onRpmChange={(rpm) => dispatch({ type: "warmIdleChanged", rpm })}
      min={IDLE_RPM_MIN}
      max={IDLE_RPM_MAX}
      warning={view.warning}
      idleCurve={view.idleCurve}
    />
  );
}
