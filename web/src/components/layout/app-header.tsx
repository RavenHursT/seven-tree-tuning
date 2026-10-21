import Image from "next/image";
import { GithubLogoIcon } from "@phosphor-icons/react/ssr";

import { ModeToggle } from "@/components/layout/mode-toggle";
import { Button } from "@/components/ui/button";

const REPOSITORY_URL = "https://github.com/RavenHursT/seven-tree-tuning";

const LOGO_PROPS = {
  width: 824,
  height: 760,
  sizes: "56px",
  fetchPriority: "high",
} as const;

function BrandLogo() {
  return (
    <>
      <Image
        src="/brand/seven-tree-logo.png"
        alt=""
        className="h-12 w-auto shrink-0 dark:hidden"
        {...LOGO_PROPS}
      />
      <Image
        src="/brand/seven-tree-logo-dark.png"
        alt=""
        className="hidden h-12 w-auto shrink-0 dark:block"
        {...LOGO_PROPS}
      />
    </>
  );
}

function AppTitle() {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <h1 className="truncate font-heading text-sm font-semibold sm:text-base">
        Seven-Tree Tune Editor
      </h1>
      <p className="truncate text-xs text-muted-foreground">
        Hydra chip tunes · 1996 F-350 7.3L · PCM TDE1
      </p>
    </div>
  );
}

function RepositoryLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <a
        href={REPOSITORY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="seven-tree-tuning on GitHub"
      >
        <GithubLogoIcon />
        <span className="hidden sm:inline">GitHub</span>
      </a>
    </Button>
  );
}

export function AppHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <BrandLogo />
        <AppTitle />
        <div className="ml-auto flex items-center gap-1">
          <RepositoryLink />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
