import { useCallback, useEffect, useState } from "react";
import { EVENTS, useJoyride } from "react-joyride";

import { tourSteps } from "@/lib/tour-steps";

export const TOUR_SEEN_KEY = "practice-tool-tour-seen";

export function useTour() {
  const [hasSeenTour, setHasSeenTour] = useState(
    () => localStorage.getItem(TOUR_SEEN_KEY) === "true",
  );
  const [showWelcome, setShowWelcome] = useState(false);

  const markSeen = useCallback(() => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    setHasSeenTour(true);
  }, []);

  const { controls, Tour } = useJoyride({
    steps: tourSteps,
    continuous: true,
    scrollToFirstStep: true,
    // `close` becomes the X button's `title` and `aria-label` — joyride renders
    // its own svg glyph, so this is the only place the Esc hint can surface.
    locale: { last: "Finish", close: "Close (Esc)" },
    options: {
      // The player steps anchor to DOM that only exists once the demo's stems
      // have been fetched and decoded. Joyride polls for a target for this long
      // and then gives up for good — it does not re-anchor when the element
      // shows up later — so this has to outlast a slow load.
      targetWaitTimeout: 15000,
      skipBeacon: true,
      showProgress: true,
      // No "skip" — it did the same thing as the X, so the X is the one exit.
      buttons: ["back", "close", "primary"],
      // v3's `close` action means "dismiss this tooltip and advance" — it
      // bumps the step index. The X should end the tour, which is `skip`.
      closeButtonAction: "skip",
      // `dismissKeyAction` has no "skip" option — every setting it does accept
      // either advances the tour or replays the step — so Escape is handled
      // below instead.
      dismissKeyAction: false,
      overlayClickAction: false,
      zIndex: 10000,
      primaryColor: "var(--primary)",
      backgroundColor: "var(--popover)",
      arrowColor: "var(--popover)",
      textColor: "var(--popover-foreground)",
      overlayColor: "rgba(0, 0, 0, 0.6)",
    },
    styles: {
      // Joyride derives the primary button's text colour from
      // `backgroundColor`, which is a light surface — that washes out against
      // the light `--primary`. Pair it with the dark `--primary-foreground`
      // instead, matching the app's own `bg-primary text-primary-foreground`.
      buttonPrimary: { color: "var(--primary-foreground)" },
    },
    onEvent: (data) => {
      // Fires once the tour finishes or is skipped, however it ended.
      // Uncontrolled mode resets joyride's own state for us.
      if (data.type === EVENTS.TOUR_END) markSeen();
    },
  });

  // Escape ends the tour, matching the X and Skip buttons. `skip()` no-ops
  // unless the tour is running, so this stays inert the rest of the time —
  // including while the welcome modal is up, which handles Escape itself.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") controls.skip();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [controls]);

  const startTour = useCallback(
    (startIndex = 0) => {
      setShowWelcome(false);
      controls.start(startIndex);
    },
    [controls],
  );

  const declineTour = useCallback(() => {
    markSeen();
    setShowWelcome(false);
  }, [markSeen]);

  return {
    hasSeenTour,
    showWelcome,
    setShowWelcome,
    startTour,
    declineTour,
    Tour,
  };
}
