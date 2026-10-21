import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getLibraryTunes } from "@/features/library";

import { toLibraryTuneOption } from "./library-options";
import { LibrarySection } from "./library-section";

const PHP_HYDRA_PAGE = "https://gopowerhungry.com/pages/hydra-chip";

/** Server Component: PHP's public TDE1 tunes, cached for a day. Render it inside Suspense. */
export async function LibraryTunes() {
  const result = await getLibraryTunes();
  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <AlertTitle>PHP&apos;s library is unavailable</AlertTitle>
        <AlertDescription>{`${result.message} Uploading a file still works.`}</AlertDescription>
      </Alert>
    );
  }
  return (
    <LibrarySection tunes={result.tunes.map(toLibraryTuneOption)} sourceUrl={PHP_HYDRA_PAGE} />
  );
}

export function LibraryTunesFallback() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}
