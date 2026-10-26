"use client";

import * as React from "react";
import { WarningIcon } from "@phosphor-icons/react";
import type { GridGroup, GridId } from "@seven-tree/hydra";

import { CollapsibleModule } from "@/components/layout/collapsible-module";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { GridEditor } from "../components/grid-editor";
import { NoTuneNotice } from "../components/no-tune-notice";
import { findGrid } from "../state/grid-edits";
import {
  selectGridEditorView,
  selectGridTabs,
  summarizeGridGroup,
  type GridTabView,
} from "../state/grid-selectors";
import { useTuneEditor } from "../tune-editor-provider";

export interface GridModuleProps {
  /** DOM id of the module card. */
  id: string;
  title: string;
  group: GridGroup;
  /** One sentence that says these values can damage the engine. */
  caution: string;
  /** What the module shows once a tune is loaded, for the notice before that. */
  noTuneDescription: string;
  icon: React.ReactNode;
}

/**
 * A collapsed-by-default module with one tab for each grid of its group. The cell values live in
 * the editor state, so a grid keeps its edits while its tab or the module is closed.
 */
export function GridModule({
  id,
  title,
  group,
  caution,
  noTuneDescription,
  icon,
}: GridModuleProps) {
  const { state } = useTuneEditor();

  return (
    <CollapsibleModule
      id={id}
      title={title}
      summary={summarizeGridGroup(state, group)}
      defaultOpen={false}
    >
      {state.tune ? (
        <GridTabs group={group} caution={caution} />
      ) : (
        <NoTuneNotice icon={icon} description={noTuneDescription} />
      )}
    </CollapsibleModule>
  );
}

function tabLabel(tab: GridTabView): React.ReactNode {
  if (tab.changedCells === 0) return tab.label;
  return (
    <>
      {tab.label}
      <span className="bg-primary px-1 text-[0.625rem] text-primary-foreground tabular-nums">
        {tab.changedCells}
        <span className="sr-only"> changed</span>
      </span>
    </>
  );
}

function GridTabs({ group, caution }: { group: GridGroup; caution: string }) {
  const { state } = useTuneEditor();
  const tabs = selectGridTabs(state, group);
  const [selected, setSelected] = React.useState<GridId>(tabs[0]?.id ?? "max-fuel");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="flex items-start gap-1.5 text-warning">
        <WarningIcon className="mt-0.5 size-3.5 shrink-0" />
        {caution}
      </p>
      <Tabs value={selected} onValueChange={(value) => setSelected(value as GridId)}>
        <TabsList className="h-auto w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="h-7 flex-none">
              {tabLabel(tab)}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="flex min-w-0 flex-col gap-3">
            <GridPanel gridId={tab.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function GridPanel({ gridId }: { gridId: GridId }) {
  const { state, dispatch } = useTuneEditor();
  const view = selectGridEditorView(state, gridId);
  if (!view) return null;

  return (
    <>
      <p className="text-muted-foreground">{findGrid(gridId).description}</p>
      <GridEditor
        {...view}
        onCellChange={(row, col, raw) =>
          dispatch({ type: "gridCellChanged", gridId, row, col, raw })
        }
        onScale={(factor) => dispatch({ type: "gridScaled", gridId, factor })}
        onReset={() => dispatch({ type: "gridReset", gridId })}
      />
    </>
  );
}
