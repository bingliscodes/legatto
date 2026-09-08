import { type Step } from "react-joyride";

// `label` is our own field for the help-button step menu; react-joyride
// ignores unknown keys on a Step.
export type TourStep = Step & { label: string };

export const tourSteps: TourStep[] = [
  {
    label: "Demo track",
    target: '[data-tour="demo-track"]',
    title: "Start with the demo",
    content:
      "A ready-to-play demo track lives here. We've loaded it for you — later you can click any track like this to open it.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    label: "Player controls",
    target: '[data-tour="player-controls"]',
    title: "Play along",
    content:
      "Play, pause, and stop the mix. Toggle Loop to repeat a section, and drag the tempo slider to slow things down without changing pitch. Hit Play to hear every stem together.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    label: "Seek bar",
    target: '[data-tour="seek-bar"]',
    title: "Jump around the track",
    content:
      "Click anywhere on this bar to jump to that spot. With Loop on, drag the handles to set the section you want to repeat.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    label: "Stem volumes",
    target: '[data-tour="stem-controls"]',
    title: "Mix each part",
    content:
      "Every instrument gets its own volume slider. Use M to mute a part or S to solo it — solo the guitar to learn a riff, or mute it to play along yourself.",
    placement: "top",
    disableBeacon: true,
  },
];
