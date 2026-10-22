import type * as React from "react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export interface NoTuneNoticeProps {
  /** An icon for the module, for example `<TireIcon />`. */
  icon: React.ReactNode;
  /** What to do, and what the module shows once a tune is loaded. */
  description: string;
}

/** What a module that needs a tune shows before one is loaded: an icon, "No tune loaded", what to do. */
export function NoTuneNotice({ icon, description }: NoTuneNoticeProps) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>No tune loaded</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
