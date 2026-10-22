"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { formatTireSize } from "@seven-tree/hydra";

import { CollapsibleModule } from "@/components/layout/collapsible-module";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { TireSizeFields } from "../components/tire-size-fields";
import { selectSpeedometerFactor, selectTireDiameters } from "../state/editor-selectors";
import { summarizeTires } from "../state/module-summaries";
import {
  formatTireSizeValue,
  selectTireSizeOptions,
  tireSizeValueFromParts,
  tireSizeValueParts,
} from "../state/tire-options";
import { useTuneEditor } from "../tune-editor-provider";

const LOCKED_MESSAGE = "Upload or select a base tune first.";

/** The sizes the tire lists offer. The tire chart never changes, so it is read once. */
const TIRE_SIZE_OPTIONS = selectTireSizeOptions();

/**
 * The tires on the truck and the tire size the speedometer is calibrated for. Both turn the base
 * tune's shift points into speedometer mph, so the module stays disabled until a tune is loaded.
 */
export function TiresModule() {
  const { state } = useTuneEditor();

  return (
    <CollapsibleModule
      id="tires"
      title="Tires"
      summary={summarizeTires(state)}
      disabled={!state.tune}
      disabledMessage={LOCKED_MESSAGE}
    >
      <div className="space-y-6">
        <FittedTires />
        <CalibrationTires />
        <TireCompensation />
      </div>
    </CollapsibleModule>
  );
}

function FittedTires() {
  const { state, dispatch } = useTuneEditor();

  return (
    <TireSizeFields
      id="fitted-tire"
      legend="Tires on the truck"
      description="The 1996 F-350 came with LT235/85R16."
      value={state.fittedTire}
      diameterIn={selectTireDiameters(state).fitted}
      options={TIRE_SIZE_OPTIONS}
      toParts={tireSizeValueParts}
      fromParts={tireSizeValueFromParts}
      format={formatTireSizeValue}
      onChange={(tire) => dispatch({ type: "fittedTireChanged", tire })}
    />
  );
}

function CalibrationTires() {
  const { state, dispatch } = useTuneEditor();

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group -ml-2">
          Speedometer calibration
          <CaretDownIcon className="transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <TireSizeFields
          id="calibration-tire"
          legend="Tire size the speedometer is calibrated for"
          description="The PCM computes speed, and the tune's shift points, for this size. Keep the factory size unless the speedometer was recalibrated."
          value={state.calibrationTire}
          diameterIn={selectTireDiameters(state).calibration}
          options={TIRE_SIZE_OPTIONS}
          toParts={tireSizeValueParts}
          fromParts={tireSizeValueFromParts}
          format={formatTireSizeValue}
          onChange={(tire) => dispatch({ type: "calibrationTireChanged", tire })}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The speedometer factor, and the button that rewrites every shift point for the fitted tires. */
function TireCompensation() {
  const { state, applyTireCompensation } = useTuneEditor();
  const factor = selectSpeedometerFactor(state);
  const calibrationSize = formatTireSize(state.calibrationTire);

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm">
        Speedometer mph = shift point × <span className="font-semibold">{factor.toFixed(4)}</span>
        <span className="text-muted-foreground">
          {` (${formatTireSize(state.fittedTire)} fitted, ${calibrationSize} calibration)`}
        </span>
      </p>
      <Button
        variant="secondary"
        disabled={!state.tune || factor === 1}
        onClick={applyTireCompensation}
      >
        Set shift points for these tires
      </Button>
      <p className="text-xs text-muted-foreground">
        {`Replaces every shift point with the base tune's value × ${(1 / factor).toFixed(4)}, so each shift happens at the same road speed as on ${calibrationSize} tires. Use it on a tune that is not already tire-compensated.`}
      </p>
    </div>
  );
}
