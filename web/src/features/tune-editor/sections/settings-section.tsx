"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { formatTireSize } from "@seven-tree/hydra";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { ChipSerialField } from "../components/chip-serial-field";
import { TireSizeFields } from "../components/tire-size-fields";
import {
  selectChipSerialError,
  selectSpeedometerFactor,
  selectTireDiameters,
} from "../state/editor-selectors";
import {
  formatTireSizeValue,
  parseTireSizeValue,
  selectTireSizeOptions,
} from "../state/tire-options";
import { useTuneEditor } from "../tune-editor-provider";

export function SettingsSection() {
  const { state, dispatch, setChipSerial, applyTireCompensation } = useTuneEditor();
  const options = selectTireSizeOptions();
  const diameters = selectTireDiameters(state);
  const factor = selectSpeedometerFactor(state);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chip and tires</CardTitle>
        <CardDescription>
          The serial opens and builds .hcf files. The tire sizes turn the tune&apos;s shift points
          into speedometer mph.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ChipSerialField
          id="chip-serial"
          value={state.chipSerial}
          onChange={setChipSerial}
          error={selectChipSerialError(state.chipSerial)}
        />
        <TireSizeFields
          id="fitted-tire"
          legend="Tires on the truck"
          description="The 1996 F-350 came with LT235/85R16."
          value={state.fittedTire}
          diameterIn={diameters.fitted}
          options={options}
          parse={parseTireSizeValue}
          format={formatTireSizeValue}
          onChange={(tire) => dispatch({ type: "fittedTireChanged", tire })}
        />
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
              diameterIn={diameters.calibration}
              options={options}
              parse={parseTireSizeValue}
              format={formatTireSizeValue}
              onChange={(tire) => dispatch({ type: "calibrationTireChanged", tire })}
            />
          </CollapsibleContent>
        </Collapsible>
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm">
            Speedometer mph = shift point ×{" "}
            <span className="font-semibold">{factor.toFixed(4)}</span>
            <span className="text-muted-foreground">
              {` (${formatTireSize(state.fittedTire)} fitted, ${formatTireSize(state.calibrationTire)} calibration)`}
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
            {`Replaces every shift point with the starting tune's value × ${(1 / factor).toFixed(4)}, so each shift happens at the same road speed as on ${formatTireSize(state.calibrationTire)} tires. Use it on a tune that is not already tire-compensated.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
