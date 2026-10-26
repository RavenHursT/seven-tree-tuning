"use client";

import { GasPumpIcon } from "@phosphor-icons/react";

import { GridModule } from "./grid-module";

/** The fuel and power grids of the loaded tune. */
export function FuelPowerModule() {
  return (
    <GridModule
      id="fuel-power"
      title="Fuel and power"
      group="fuel-power"
      caution="These grids set how much fuel the engine gets, and a wrong value can damage the engine, so change a few cells at a time."
      noTuneDescription="Upload a .hcf or pick a PHP library tune to see its fuel and power grids."
      icon={<GasPumpIcon />}
    />
  );
}
