"use client";

import { GenerateTuneBar } from "../components/generate-tune-bar";
import { selectChangeSummary, selectGenerateDisabledReason } from "../state/editor-selectors";
import { useTuneEditor } from "../tune-editor-provider";

export function GenerateSection() {
  const { state, dispatch, generate, generating, resetAll } = useTuneEditor();
  const summary = selectChangeSummary(state);

  return (
    <GenerateTuneBar
      fileName={state.outputFileName}
      onFileNameChange={(value) => dispatch({ type: "outputFileNameChanged", value })}
      changedShiftPoints={summary.changedShiftPoints}
      idleChanged={summary.idleChanged}
      changedLockupPoints={summary.changedLockupPoints}
      changedFirmnessPoints={summary.changedFirmnessPoints}
      disabledReason={selectGenerateDisabledReason(state)}
      generating={generating}
      onGenerate={() => void generate()}
      onResetAll={state.tune ? resetAll : undefined}
    />
  );
}
