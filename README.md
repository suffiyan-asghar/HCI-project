# StudyBot

A web app that runs our HCI study on AI tutoring, over-reliance and retention. Participants answer GRE-style verbal questions, some with an AI tutor (StudyBot), and the app records everything in a SQLite database on one laptop.

- **The study design:** [docs/EXPERIMENT_PLAN.md](docs/EXPERIMENT_PLAN.md)
- **How the app is built:** [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)
- **All questions, for proofreading:** [docs/QUESTION_SHEET.md](docs/QUESTION_SHEET.md)

## Setting up the server laptop

One laptop runs the server; it should stay plugged in and on the same Wi-Fi as the study laptops.

1. Install [Node.js](https://nodejs.org) 22.13 or newer (the current LTS is fine).
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env` and fill in `GROQ_API_KEY` and `RESEARCHER_PASSWORD`.
4. Run `npm run check`. Fix anything marked ✗.
5. Run `npm start`. It prints the address for the study laptops, for example `http://192.168.1.20:3000`.

If Windows asks whether to allow Node.js on the network, allow it on private networks, or the study laptops can't connect.

## On each study laptop

Open the printed address in Chrome, Edge or Firefox. Nothing to install. The first time, enter the researcher password.

## Each collection day

Before the first participant:

- [ ] `npm start` on the server laptop; the tutor line says `live (openai/gpt-oss-120b)`.
- [ ] Every study laptop opens the address and shows **New session**.
- [ ] Run one demo session (tick **Demo session** on the start screen) on one laptop and check the tutor replies.

During the day:

- [ ] Keep `/admin` open on the researcher's laptop. Watch the group balance and the **Tutor** line. If it reports replies replaced by canned replies, check the Groq key and quota before the next participant.
- [ ] Only one StudyBot tab per laptop.
- [ ] To stop a session early (participant withdraws, something broke): Ctrl+Shift+X.

After the last participant:

- [ ] On `/admin`, download `studybot.sqlite` and the four CSVs, and copy them off the server laptop (USB or cloud). The server also keeps automatic backups in `data/backups/`.
- [ ] In `chat.csv`, skim a few replies from the live tutor, especially on wrong-answer questions, and note any odd ones.

## Development

```
npm run server   # API on port 3000 (restarts when server files change)
npm run dev      # app on port 5173, forwarding /api to the server
npm test         # session builder, tutor reply checks, API and database
```

After editing `src/data/questions.json`, run `npm run questions:sheet` to refresh the proofreading sheet.
