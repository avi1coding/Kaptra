"use client";

import { TOUR_EVENT } from "./Tour";

export function TourButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
      className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-muted/50 hover:text-chalk"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M9.4 9a2.7 2.7 0 1 1 3.4 2.6c-.5.2-.8.6-.8 1.1v.6" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </svg>
      Tour
    </button>
  );
}
