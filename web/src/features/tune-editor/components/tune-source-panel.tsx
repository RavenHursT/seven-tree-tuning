import type * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface TuneSourcePanelProps {
  upload: React.ReactNode;
  library: React.ReactNode;
  defaultTab?: "upload" | "library";
}

export function TuneSourcePanel({ upload, library, defaultTab = "upload" }: TuneSourcePanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Starting tune
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
