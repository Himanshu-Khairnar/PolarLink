"use client";

import * as React from "react";

/**
 * Keeps a tab / filter selection in sync with a URL search parameter so the
 * active tab survives reloads and can be shared as a link.
 *
 * The native History API is used instead of a router navigation (see the
 * Next.js "Native History API" guide): it updates the address bar in place and
 * integrates with the Next.js Router without triggering a re-render of the
 * route. Because no `useSearchParams` hook is involved, no Suspense boundary is
 * required for prerendered routes.
 *
 * @param key      Search-parameter name, e.g. "expedition".
 * @param fallback Value used when the parameter is absent or invalid.
 * @param isValid  Optional guard deciding whether a URL value is acceptable.
 */
export function useTabParam(
  key: string,
  fallback: string,
  isValid?: (value: string) => boolean,
): [string, (value: string) => void] {
  const [value, setValue] = React.useState(fallback);

  React.useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(key);
    if (fromUrl && fromUrl !== fallback && (!isValid || isValid(fromUrl))) {
      // Sync once on mount from the URL; intentional to avoid a hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(fromUrl);
    }
    // Read the URL once; later changes come from the setter below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = React.useCallback(
    (next: string) => {
      setValue(next);
      const params = new URLSearchParams(window.location.search);
      params.set(key, next);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`,
      );
    },
    [key],
  );

  return [value, set];
}
