"use client";

import * as React from "react";
import { CaretDownIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface CollapsibleModuleProps {
  /** DOM id of the card. The summary text gets the id `${id}-summary`. */
  id: string;
  /** Heading text and the accessible name of the toggle button. */
  title: string;
  /** Shown right after the title, outside the toggle button, for example a help button. */
  headingAction?: React.ReactNode;
  /** The set values, shown in the header while the module is collapsed. */
  summary: React.ReactNode;
  /** Whether the module starts open. The module keeps its own open state afterwards. */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * A card whose header is a level 2 heading with a toggle button. Collapsed, it shows only
 * `summary`; the content is not rendered. Open, it shows the content and no summary.
 */
export function CollapsibleModule({
  id,
  title,
  headingAction,
  summary,
  defaultOpen = true,
  children,
  className,
}: CollapsibleModuleProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const summaryId = `${id}-summary`;

  return (
    <Card id={id} className={className}>
      <Collapsible open={open} onOpenChange={setOpen} className="contents">
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            <h2>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="group/toggle -ml-2.5 text-sm aria-expanded:bg-transparent aria-expanded:hover:bg-muted"
                  aria-describedby={open ? undefined : summaryId}
                >
                  {title}
                  <CaretDownIcon
                    aria-hidden="true"
                    data-icon="inline-end"
                    className="transition-transform group-data-[state=open]/toggle:rotate-180"
                  />
                </Button>
              </CollapsibleTrigger>
            </h2>
            {headingAction}
          </CardTitle>
          {open ? null : (
            <div id={summaryId} className="wrap-anywhere text-muted-foreground">
              {summary}
            </div>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
