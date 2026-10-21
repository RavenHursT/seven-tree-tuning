"use client";

import { GenerateTuneBar } from "../components/generate-tune-bar";
import { selectChangeSummary, selectGenerateDisabledReason } from "../state/editor-selectors";
import { useTuneEditor } from "../tune-editor-provider";

export function GenerateSection() {
  const { state, dispatch, generate, generating } = useTuneEditor();
  const summary = selectChangeSummary(state);

  return (
    <GenerateTuneBar
      fileName={state.outputFileName}
      onFileNameChange={(value) => dispatch({ type: "outputFileNameChanged", value })}
      changedShiftPoints={summary.changedShiftPoints}
      idleChanged={summary.idleChanged}
      disabledReason={selectGenerateDisabledReason(state)}
      generating={generating}
      onGenerate={() => void generate()}
      onResetAll={state.tune ? () => dispatch({ type: "allReset" }) : undefined}
    />
  );
}
