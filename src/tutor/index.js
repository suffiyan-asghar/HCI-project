import { mockReply } from './mockTutor';

// The single place the UI asks for a tutor reply. Build step 4 replaces the mock
// with a call to our server, which holds the API key and talks to the AI model.
export async function getTutorReply({ question, level, planted }) {
  await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 700));
  return mockReply({ question, level, planted });
}
