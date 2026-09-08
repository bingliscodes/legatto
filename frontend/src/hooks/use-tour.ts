import { useCallback, useState } from "react";
import { ACTIONS, EVENTS, STATUS, type CallBackProps } from "react-joyride";

export const TOUR_SEEN_KEY = "practice-tool-tour-seen";

export function useTour() {
  const [hasSeenTour, setHasSeenTour] = useState(
    () => localStorage.getItem(TOUR_SEEN_KEY) === "true",
  );
  const [showWelcome, setShowWelcome] = useState(false);
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const markSeen = useCallback(() => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    setHasSeenTour(true);
  }, []);

  const startTour = useCallback((startIndex = 0) => {
    setShowWelcome(false);
    setStepIndex(startIndex);
    setRun(true);
  }, []);

  const finishTour = useCallback(() => {
    markSeen();
    setRun(false);
    setStepIndex(0);
  }, [markSeen]);

  const declineTour = useCallback(() => {
    markSeen();
    setShowWelcome(false);
  }, [markSeen]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data;

      if (
        status === STATUS.FINISHED ||
        status === STATUS.SKIPPED ||
        action === ACTIONS.CLOSE
      ) {
        finishTour();
      } else if (type === EVENTS.STEP_AFTER) {
        // Controlled mode: we own stepIndex. Leaving TARGET_NOT_FOUND
        // unhandled means a not-yet-loaded target simply waits — the
        // component re-renders when `loaded` flips and Joyride re-anchors.
        setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
      }
    },
    [finishTour],
  );

  return {
    hasSeenTour,
    showWelcome,
    setShowWelcome,
    run,
    stepIndex,
    startTour,
    finishTour,
    declineTour,
    handleJoyrideCallback,
  };
}
