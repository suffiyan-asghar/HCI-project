// Study parameters. Change them here, not in components.
export const CONFIG = {
  rounds: 3,

  // Practice questions per round (up to the 5 in each block). Drop to 4 if the pilot
  // shows sessions running well over 35 minutes; the wrong-answer positions below still fit.
  practicePerRound: 5,

  // Adaptive tutor: looks at the last `window` answers given without AI help.
  adaptive: {
    window: 4,
    fullBelow: 0.5, // below 50% correct -> full answer
    hintBelow: 0.75, // 50-74% -> hint; 75%+ -> guiding question
  },

  // After each tutor reply, follow-up messages unlock after this delay, for both AI groups
  // alike. Stops clicking through hints to the answer without reading them. 0 turns it off.
  followUpDelayMs: 6000,

  // Wrong-answer checks: practice positions (round, 0-based index) where any
  // full answer from the tutor is the planted wrong option. Fixed by position so
  // that question-set rotation never changes how many a participant sees.
  plantedPositions: [
    { round: 1, index: 3 },
    { round: 3, index: 1 },
  ],

  // Retention test: which earlier question of each round is asked again. For practice,
  // the first listed position that isn't a wrong-answer check is used.
  retention: {
    practicePick: [2, 0, 4, 1, 3],
    soloPick: 1,
  },

  // Demo session for the recording: a short run through every kind of screen, never
  // counted in the data. One wrong-answer check is placed where the demo reaches it.
  demo: {
    rounds: 1,
    warmup: 1,
    practice: 2,
    solo: 1,
    transfer: 1,
    plantedPositions: [{ round: 1, index: 1 }],
  },
};
