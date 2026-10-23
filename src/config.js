// Study parameters from docs/plan_hci_project.pdf. Change them here, not in components.
export const CONFIG = {
  rounds: 3,

  // Adaptive tutor: looks at the last `window` answers given without AI help.
  adaptive: {
    window: 4,
    fullBelow: 0.5, // below 50% correct -> full answer
    hintBelow: 0.75, // 50-74% -> hint; 75%+ -> guiding question
  },

  // Wrong-answer checks: practice positions (round, 0-based index) where any
  // full answer from the tutor is the planted wrong option. Fixed by position so
  // that question-set rotation never changes how many a participant sees.
  plantedPositions: [
    { round: 1, index: 3 },
    { round: 3, index: 1 },
  ],
};
