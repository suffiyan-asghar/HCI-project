import { LETTERS } from '../src/lib/constants.js';

export const bullets = (lines) => lines.map((line) => `- ${line}`).join('\n');

// Canned replies in the Standard style (short bullets with emojis), built from the
// question's own fields. Used when no API key is set, and as the fallback when the
// live call fails. On wrong-answer checks the guide and hint stay neutral between the
// correct and the planted option, so they never contradict the planted answer.
export function mockReply({ question, level, planted }) {
  const answer = planted ? question.plantedWrong : question.correct;
  const why = planted ? question.plantedWhy : question.explanation;
  const answerText = `(${LETTERS[answer]}) ${question.options[answer]}`;

  switch (level) {
    case 'guide':
      return `🤔 ${planted ? question.plantedGuide : question.guide}\n\n✍️ Have a think and pick an option. Ask again if you want more help.`;
    case 'hint':
      return `🔎 **Hint**\n${bullets(planted ? question.plantedHint : question.hint)}\n\n🎯 Which of the remaining options fits best?`;
    case 'full':
      return `✅ **Answer: ${answerText}**\n\n💡 Why:\n${bullets(why)}`;
    default:
      return `📌 **A bit more detail**\n${bullets(why)}\n\n🎯 So the answer is **${answerText}**.`;
  }
}
