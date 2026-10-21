import { fetchLibraryTuneFile, libraryTuneResponse } from "@/features/library";

interface LibraryRouteContext {
  params: Promise<{ fileName: string }>;
}

/**
 * Downloads one TDE1 tune file (.efu) from PHP's public library. The browser cannot fetch it
 * from PHP directly because PHP's site sends no CORS headers. Answers 404 for a name that is not
 * a tune in the library and 502 when PHP is unreachable or sends a file of the wrong size.
 */
export async function GET(_request: Request, { params }: LibraryRouteContext): Promise<Response> {
  const { fileName } = await params;
  return libraryTuneResponse(await fetchLibraryTuneFile(fileName));
}
