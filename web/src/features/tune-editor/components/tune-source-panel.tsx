import type * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface TuneSourcePanelProps {
  upload: React.ReactNode;
  library: React.ReactNode;
  defaultTab?: "upload" | "library";
}

/**
 * The two ways to pick a base tune: upload a file, or choose from PHP's public library. It draws
 * no card and no heading; the Base Tune module around it provides both.
 */
export function TuneSourcePanel({ upload, library, defaultTab = "upload" }: TuneSourcePanelProps) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList aria-label="Tune source" className="w-full">
        <TabsTrigger value="upload">Upload a file</TabsTrigger>
        <TabsTrigger value="library">PHP public library</TabsTrigger>
      </TabsList>
      <TabsContent value="upload" className="pt-2">
        {upload}
      </TabsContent>
      <TabsContent value="library" className="pt-2">
        {library}
      </TabsContent>
    </Tabs>
  );
}
