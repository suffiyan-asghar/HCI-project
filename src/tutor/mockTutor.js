import { LETTERS } from '../lib/session';

const bullets = (lines) => lines.map((line) => `- ${line}`).join('\n');

// Canned replies in the Standard style (short bullets with emojis), built from
// the question's own fields. Used until the live AI is connected.
export function mockReply({ question, level, planted }) {
  const answer = planted ? question.plantedWrong : question.correct;
  const why = planted ? question.plantedWhy : question.explanation;
  const answerText = `(${LETTERS[answer]}) ${question.options[answer]}`;

  switch (level) {
    case 'guide':
      return `🤔 ${question.guide}\n\n✍️ Have a think and pick an option. Ask again if you want more help.`;
    case 'hint':
      return `🔎 **Hint**\n${bullets(question.hint)}\n\n🎯 Which of the remaining options fits best?`;
    case 'full':
      return `✅ **Answer: ${answerText}**\n\n💡 Why:\n${bullets(why)}`;
    default:
      return `📌 **A bit more detail**\n${bullets(why)}\n\n🎯 So the answer is **${answerText}**.`;
  }
}
