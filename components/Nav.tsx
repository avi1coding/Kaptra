import Link from "next/link";
import { Logo } from "./Logo";
import { TourButton } from "./studio/TourButton";

export function Nav({ variant = "landing" }: { variant?: "landing" | "app" }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {variant === "landing" ? (
            <>
              <Link
                href="/studio"
                className="ml-2 rounded-lg bg-chalk px-4 py-2 font-semibold text-ink transition-transform hover:-translate-y-px active:translate-y-0"
              >
                Open Studio
              </Link>
            </>
          ) : (
            <>
              <TourButton />
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-muted transition-colors hover:text-chalk"
              >
                ← Back to site
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
