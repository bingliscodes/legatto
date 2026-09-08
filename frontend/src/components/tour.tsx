import { useEffect, useRef } from "react";
import Joyride from "react-joyride";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tourSteps } from "@/lib/tour-steps";
import { useTour } from "@/hooks/use-tour";

type TourProps = {
  hasDemo: boolean;
  loaded: boolean;
  loadDemo: () => void;
};

export function Tour({ hasDemo, loaded, loadDemo }: TourProps) {
  const {
    hasSeenTour,
    showWelcome,
    setShowWelcome,
    run,
    stepIndex,
    startTour,
    declineTour,
    handleJoyrideCallback,
  } = useTour();

  // Auto-open the welcome modal once, on the first visit, but only after the
  // demo track is available (tracks load async) so the tour has valid anchors.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!hasSeenTour && hasDemo && !autoOpened.current) {
      autoOpened.current = true;
      setShowWelcome(true);
    }
  }, [hasSeenTour, hasDemo, setShowWelcome]);

  const begin = (startIndex = 0) => {
    if (!loaded) loadDemo();
    startTour(startIndex);
  };

  return (
    <>
      <TourWelcomeModal
        open={showWelcome}
        onAccept={() => begin(0)}
        onDecline={declineTour}
      />

      <Joyride
        steps={tourSteps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton
        disableOverlayClose
        scrollToFirstStep
        callback={handleJoyrideCallback}
        locale={{ last: "Finish" }}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: "var(--primary)",
            backgroundColor: "var(--popover)",
            arrowColor: "var(--popover)",
            textColor: "var(--popover-foreground)",
            overlayColor: "rgba(0, 0, 0, 0.6)",
          },
        }}
      />

      <TourHelpButton onStart={begin} />
    </>
  );
}

function TourWelcomeModal({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onDecline();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black/60" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg focus:outline-none">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Take a quick tour?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
            New here? We'll show you the demo track and how to play along, slow
            things down, and mix each part. Takes about a minute.
          </DialogPrimitive.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onDecline}>
              No thanks
            </Button>
            <Button onClick={onAccept}>Take the tour</Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function TourHelpButton({ onStart }: { onStart: (startIndex?: number) => void }) {
  return (
    <div className="fixed right-4 bottom-4 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full shadow-md"
            aria-label="Help and tour"
          >
            <CircleHelp />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onClick={() => onStart(0)}>
            Start from the beginning
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {tourSteps.map((step, index) => (
            <DropdownMenuItem key={step.label} onClick={() => onStart(index)}>
              {step.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
