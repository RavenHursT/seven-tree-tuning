"use client";

import type * as React from "react";
import { QuestionIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface HelpPopoverProps {
  /** Accessible name of the button and of the popover, for example "About the base tune". */
  label: string;
  /** The help text. */
  children: React.ReactNode;
}

/**
 * A small question-mark button that opens a popover with help text. Escape closes it and puts
 * focus back on the button. A click outside closes it and leaves focus on what was clicked.
 */
export function HelpPopover({ label, children }: HelpPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <QuestionIcon aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={label}
        align="start"
        collisionPadding={8}
        className="w-80 max-w-[calc(100vw-2rem)] text-xs/relaxed"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
