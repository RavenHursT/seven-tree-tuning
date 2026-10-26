"use client";

import { TimerIcon } from "@phosphor-icons/react";

import { GridModule } from "./grid-module";

/** The injection timing and injection control pressure (ICP) grids of the loaded tune. */
export function TimingIcpModule() {
  return (
    <GridModule
      id="timing-icp"
      title="Timing and ICP"
      group="timing-icp"
      caution="These grids set injection timing and injection control pressure, and a wrong value can damage the engine, so change a few cells at a time."
      noTuneDescription="Upload a .hcf or pick a PHP library tune to see its timing and ICP grids."
      icon={<TimerIcon />}
    />
  );
}
