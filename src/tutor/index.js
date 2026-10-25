import { fetchTutorReply } from '../lib/api';

// The single place the UI asks for a tutor reply. The server holds the API key, builds the
// prompt for the requested help level, checks the reply, and falls back to a canned reply
// if the AI fails.
export async function getTutorReply({ session, question, level, planted, messages }) {
  return fetchTutorReply(session.token, {
    participantId: session.participantId,
    qid: question.id,
    level,
    planted,
    messages: messages.filter((m) => !m.error).map(({ role, text }) => ({ role, text })),
  });
}
