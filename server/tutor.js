import Groq from 'groq-sdk';
import { LETTERS } from './questions.js';
import { mockReply } from './mockTutor.js';

const MODEL = process.env.TUTOR_MODEL || 'openai/gpt-oss-120b';
const MAX_WORDS = 140; // the prompt asks for about 100

// Live when GROQ_API_KEY is set, unless TUTOR_MODE=mock forces canned replies.
const mode = process.env.TUTOR_MODE ?? (process.env.GROQ_API_KEY ? 'live' : 'mock');
const client = mode === 'live' ? new Groq({ timeout: 30_000, maxRetries: 1 }) : null;

export const tutorInfo = { mode, model: client ? MODEL : null };

// Running counts for the researcher page, so fallbacks (e.g. rate limits) are noticed the same day.
const stats = { live: 0, retried: 0, fallback: 0, lastError: null };
export const tutorStatus = () => ({ ...tutorInfo, ...stats });

const bullets = (lines) => lines.map((line) => `- ${line}`).join('\n');

// Stable per question. The server, not the model, decides which option is "the answer":
// on wrong-answer checks it is the planted option, and the model only explains it.
function systemPrompt(question, planted) {
  const answer = planted ? question.plantedWrong : question.correct;
  const options = question.options.map((opt, i) => `(${LETTERS[i]}) ${opt}`).join('\n');

  return `You are StudyBot, an AI tutor helping a university student with one GRE-style verbal reasoning question.

Style, for every reply:
- At most about 100 words.
- Short bullet points starting with "- ", most of them opening with a fitting emoji.
- You may use **bold** for key words. No italics, headings, tables, numbered lists or other markdown.
- Stay on this question. If the student asks about anything else, steer back politely.
- Each reply must follow the help level given in the last system message.

The question:
${question.passage ? `Passage: ${question.passage}\n` : ''}${question.stem}

Options:
${options}

The answer to give when the help level allows it: (${LETTERS[answer]}) ${question.options[answer]}
Reasoning to draw on:
${bullets(planted ? question.plantedWhy : question.explanation)}

Hint to draw on (rules out some options):
${bullets(planted ? question.plantedHint : question.hint)}

Guiding question to draw on: ${planted ? question.plantedGuide : question.guide}
${
  planted
    ? `
This question is a planned check in a research study on whether students verify AI answers; every participant is told about it in a debrief at the end. When you give the answer, present the option above confidently as correct, using the reasoning above, and do not suggest another option is correct. When you give a hint or guiding question, never rule out the option above.`
    : ''
}`;
}

const LEVEL_RULES = {
  guide:
    'Help level for this reply: GUIDING QUESTION. Ask one short guiding question that helps the student reason it through, based on the guiding question above. Do not name, quote or hint at the correct option, and do not rule options in or out, even if the student asks for the answer; say that more help is available if they ask again.',
  hint:
    'Help level for this reply: HINT. Give a hint that rules out some wrong options, based on the hint above. Do not name or quote the option that is the answer, and leave at least two options open.',
  full: 'Help level for this reply: FULL ANSWER. Start with the line "✅ **Answer: (letter) option text**", then give 2-3 short bullets explaining why.',
  more: 'Help level for this reply: MORE EXPLANATION. The answer has already been given. Respond to what the student just asked, explain the reasoning again in a different way, and restate the answer in bold as "(letter) option text".',
};

// Does the text point at option i, by letter ("(B)", "option B", "answer is B") or by its wording?
function mentions(text, question, i) {
  const letter = LETTERS[i];
  if (new RegExp(`\\(${letter}\\)|\\b(?:option|answer|choice)(?:\\s+is)?\\s*:?\\s*\\**${letter}\\b`, 'i').test(text)) return true;
  const wording = question.options[i].toLowerCase().replace(/[.]$/, '');
  return wording.length >= 4 && text.toLowerCase().includes(wording);
}

const statedLetter = (text) => text.match(/Answer\s*:?\s*\**\s*\(?([A-E])\b/i)?.[1]?.toUpperCase() ?? null;

/**
 * Checks a reply against its help level, so the logged "AI stated answer" matches what the
 * participant actually saw. Returns null when the reply is fine, or the reason it isn't.
 */
export function checkReply(text, { question, level, planted }) {
  const target = planted ? question.plantedWrong : question.correct;
  if (level === 'guide' || level === 'hint') {
    // On wrong-answer checks, naming either the correct or the planted option gives too much away.
    const revealing = [question.correct, ...(planted ? [question.plantedWrong] : [])];
    if (revealing.some((i) => mentions(text, question, i))) return 'revealed the answer';
  } else {
    const stated = statedLetter(text);
    if (stated && stated !== LETTERS[target]) return `stated (${stated}) instead of (${LETTERS[target]})`;
    if (!stated && !mentions(text, question, target)) return 'did not state the answer';
  }
  if (text.split(/\s+/).length > MAX_WORDS) return 'too long';
  return null;
}

async function complete(question, level, planted, messages, correction) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    // Reasoning tokens count towards this limit, so leave room beyond the ~100-word reply.
    max_completion_tokens: 2048,
    reasoning_effort: 'low',
    include_reasoning: false,
    messages: [
      { role: 'system', content: systemPrompt(question, planted) },
      ...messages.map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text })),
      { role: 'system', content: LEVEL_RULES[level] + (correction ? `\n\nYour previous draft ${correction}. Write it again and follow the help level exactly.` : '') },
    ],
  });
  const choice = completion.choices[0];
  const text = choice?.message?.content?.trim();
  if (!text) throw new Error(`empty reply (finish_reason ${choice?.finish_reason})`);
  return text;
}

/**
 * @param {{ question: object, level: string, planted: boolean, messages: {role: 'user'|'bot', text: string}[] }} input
 * @returns {Promise<{ text: string, source: 'live'|'mock'|'fallback', note?: string }>}
 */
export async function tutorReply({ question, level, planted, messages }) {
  const canned = () => mockReply({ question, level, planted });
  if (!client) return { text: canned(), source: 'mock' };

  try {
    let text = await complete(question, level, planted, messages);
    let problem = checkReply(text, { question, level, planted });
    if (problem) {
      stats.retried++;
      const first = problem;
      text = await complete(question, level, planted, messages, problem);
      problem = checkReply(text, { question, level, planted });
      // A reply that is only too long is still usable; one that breaks the help level is not.
      if (problem && problem !== 'too long') throw new Error(`reply ${problem} twice (first: ${first})`);
      stats.live++;
      return { text, source: 'live', note: `retried: ${first}` };
    }
    stats.live++;
    return { text, source: 'live' };
  } catch (err) {
    // The participant always gets a reply at the right help level; the source is logged.
    let message = err.message;
    if (err instanceof Groq.AuthenticationError) message = 'API key rejected';
    else if (err instanceof Groq.RateLimitError) message = 'rate limited by Groq';
    else if (err instanceof Groq.APIError) message = `API error ${err.status}: ${err.message}`;
    console.error(`[tutor] ${message}; using canned reply`);
    stats.fallback++;
    stats.lastError = { at: new Date().toISOString(), message };
    return { text: canned(), source: 'fallback', note: message };
  }
}
