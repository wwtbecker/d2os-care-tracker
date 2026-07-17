import { pocMode } from "@/lib/auth-mode";

/**
 * Persistent proof-of-concept notice, rendered from the root layout so it is
 * on every page (login included). This is a hard requirement of the POC
 * phase: once more people have the link, nobody should be able to mistake
 * this unauthenticated build for the production system.
 */
export function PocBanner() {
  if (!pocMode()) return null;
  return (
    <div
      role="note"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900"
    >
      Proof of concept — no login security yet. Do not use with real client
      data.
    </div>
  );
}
