# StudyBot Build Plan

How the StudyBot app is built. The study design itself is in [EXPERIMENT_PLAN.md](EXPERIMENT_PLAN.md), which replaces the earlier [plan_hci_project.pdf](plan_hci_project.pdf). Setup and day-of instructions are in the [README](../README.md).

- **Phase 1 submission:** October 25 (running app + experimental plan)
- **Pilot:** October 23–24
- **Data collection:** October 26–28

## Decisions made

| Topic | Decision |
|---|---|
| Stack | React frontend (Vite) + Node/Express server + SQLite (Node's built-in `node:sqlite`, so nothing native to install), in one repo. Needs Node 22.13 or newer |
| Hosting | One laptop runs the server; the other 3–4 study laptops open `http://<host-ip>:3000` on the same Wi-Fi |
| Data | Everything goes into one SQLite file on the host laptop, `data/studybot.sqlite`; the researcher page at `/admin` exports CSV (see **Database** below) |
| AI provider | **Groq, model `openai/gpt-oss-120b`**, called only from the server (`server/tutor.js`), key in `.env` as `GROQ_API_KEY`. Without a key, or if a call fails, the tutor uses canned replies at the same help level, and each reply records which it was (`live`, `mock`, `fallback`) |
| Access | `RESEARCHER_PASSWORD` protects starting sessions, `/admin` and exports. Each session gets its own secret token, so only the browser running it can save to it or use its tutor |
| Questions | 28 main, 3 transfer and 16 spare questions drafted; the team proofreads them using [QUESTION_SHEET.md](QUESTION_SHEET.md) |
| Groups | Three, rotated by auto-assign: **Standard** AI, **Adaptive** AI, and **No-AI control**. About 15 per group (~45 total) |
| Retention | One session only, no next-day follow-up. A final check at the end measures what was retained (see below) |

## What one participant goes through

```
Consent + demographics  (~2 min)
Warm-up: 4 questions, no AI                 -> effort rating
Round 1: Practice 5 (with tutor) -> Solo 3   -> effort rating after each
Round 2: Practice 5 (with tutor) -> Solo 3   -> effort rating after each
Round 3: Practice 5 (with tutor) -> Solo 3   -> effort rating after each
Final questionnaire: NASA-TLX, trust, reliance   (also the delay before the final check)
Final check: earlier questions again + new ones, no AI
Debrief: reveals the 2 wrong-answer questions
```

That is 4 + 15 + 9 = 28 questions, plus 9 in the final check, about 35 minutes. The three groups differ **only** in the practice steps: Standard and Adaptive get StudyBot, the control group does the same questions with no AI. The control group skips the StudyBot survey items and sees a shorter debrief.

## Final check (retention)

Measures what stuck, which the solo checks alone can't show. All participants, no AI:

- **Re-tested questions:** one practice and one solo question from each round, options reshuffled so the correct answer is in a new position. Practice questions that were wrong-answer checks are never re-tested.
- **Transfer questions:** 3 new questions (one per type) using the same skills as the practice set.
- **Source memory (AI groups only):** on each re-tested question, "Earlier in the session, did StudyBot help you with this question?" (Yes / No / Don't remember).
- Order is shuffled per participant. Which positions get re-tested is set in `src/config.js`.

How this answers the research questions:

| RQ | Evidence |
|---|---|
| RQ1: real AI lowers load | Warm-up vs round 1 effort; AI groups vs control on effort and NASA-TLX |
| RQ2: easy help → reliance and less retained | Standard group across rounds (copy rate, tried-before-asking); retention of practice vs solo questions; Standard vs control on retention and transfer |
| RQ3: adaptive keeps load low without that cost | Standard vs Adaptive on retention, transfer and effort |

We frame RQ2 as **lower retention and transfer**, not "memory loss" or "cognitive decline", which one session can't show.

## Tutor behaviour

Both tutors use the same style: short bullet points with emojis, about 100 words.

| | Standard | Adaptive |
|---|---|---|
| Before asking | Chat is open straight away | Student must pick a guess first, or tap "I have no idea yet" |
| First reply | Answer + short reason | Depends on the last 4 answers given without AI (see below) |
| Follow-ups | More explanation | Each one gives more help; the answer is at most 3 messages away |

**Adaptive levels**, from the student's last 4 answers given without AI help (warm-up answers count for round 1):

| Accuracy on last 4 | First reply |
|---|---|
| Below 50% | Full answer |
| 50–74% | Hint that rules out wrong options |
| 75% or more | Guiding question |

Escalation: guiding question → hint → full answer.

**Wrong-answer checks.** On 2 of the 15 practice questions, any full answer the tutor gives is a plausible but wrong one. The server decides which option the tutor must explain and passes it to the model; the model never picks the answer itself. On these questions the guiding question and hint (`plantedGuide`, `plantedHint`) stay neutral between the correct and the planted option, so they never contradict the wrong answer that follows. The debrief names these questions.

**Reply checks.** Every live reply is checked against its help level before the participant sees it: a guiding question or hint must not name the answer (or, on wrong-answer checks, the planted option), and a full answer must state the option the server chose. A failing reply is regenerated once; if it fails again, the participant gets the canned reply for that level. So the logged "AI stated answer" always matches what was shown. Retries and replacements are noted in `chat.csv`.

**Follow-up delay.** After each reply, follow-up messages unlock after 6 seconds (`followUpDelayMs` in `src/config.js`), in both AI groups. This stops clicking through hints to the answer without reading them; `participants.csv` also reports how quickly people asked again.

## Question bank

Questions live in a JSON file, separate from the app code, so proofreading edits never touch logic. Each question has:

- `id`, `type` (`blank` | `logic` | `reading`), optional `passage`, `stem`, `options`, `correct`, `explanation`
- For the tutor: `hint` (rules out wrong options) and `guide` (a guiding question)
- For wrong-answer checks: `plantedWrong` (the plausible wrong option), `plantedWhy` (convincing reasoning for it), and neutral `plantedHint` and `plantedGuide`

Every practice question and spare has all tutor fields, because any practice position can be a wrong-answer check. Transfer questions (under `transfer`) are only used in the final check. Spares (under `spares`) can replace any question of the same type. The server checks all of this at startup, including that no hint names the option it must keep open.

Question sets are rotated across rounds by participant so that difficulty is balanced. Each set mixes the three question types.

## What we log

Every event is stored against a participant ID (no names):

- Group, question set order, timestamps for every screen
- Each answer: selected option, correct or not, time on question
- Whether the student picked an option **before** opening the chat. We log this for **both** groups, otherwise RQ2 ("do they try before asking?") cannot be measured for the Standard group
- Every chat message, its help level, and the answer the AI stated
- Whether the final answer matches the AI's stated answer (copying the AI / accepting a wrong answer)
- Effort ratings (1–10), NASA-TLX, trust and reliance answers, demographics
- Final check: re-test or transfer, the round the question came from, the reshuffled option order, and the source-memory answer

## Build steps

| Step | What | Status |
|---|---|---|
| 1 | Scaffold: Vite React + Express + SQLite | Done |
| 2 | Question bank + set rotation | 28 + 3 + 16 spares drafted, balanced by type; needs proofreading |
| 3 | Session flow, effort ratings, resume after refresh (including a reply still loading) | Done |
| 4 | Tutor engine: Standard, Adaptive, control, guess-first, escalation, wrong-answer checks, reply checks | Done; live via Groq |
| 5 | Event logging to the database | Done |
| 6 | Researcher page: tutor health, group balance, session lengths, CSV and database download | Done (`/admin`) |
| 7 | Hardening: AI fallback, password and session tokens, server-side IDs and balance, sync retry, automatic backups, one-tab guard, demo mode, bank check, `npm run check`, `npm test` | Done |

Setup and day-of instructions are in the [README](../README.md).

**Backups:** while it runs, the server copies the database to `data/backups/` every 10 minutes when something changed, keeping the newest 40. Downloading the database from `/admin` also makes a copy.

## Database

One SQLite file, `data/studybot.sqlite` on the server laptop. The browser sends the full session after every change; the server stores it and rebuilds that participant's rows, so the tables always match the latest snapshot. If the server is briefly unreachable, the browser keeps retrying and keeps its own copy, and the done screen shows whether the session reached the server.

| Table | One row per | Main columns |
|---|---|---|
| `sessions` | participant | `participant_id`, `grp`, `block_order`, `status` (active / complete / excluded / aborted), `demo`, timestamps, `data` (full session JSON) |
| `answers` | answered question | section, round, block, qid, question type, selected option, correct, time, AI asked, tried before asking, help levels shown, AI's stated answer, matched AI, accepted wrong AI, re-test/transfer, source-memory answer |
| `chat_messages` | tutor message | question, role, help level, source (live / mock / fallback), note (why a reply was retried or replaced), text, time |
| `events` | logged action | time, step, type, details (JSON) |

**Exports** on `/admin`: `answers.csv`, `chat.csv` and `events.csv` mirror the tables. `participants.csv` has one row per person with everything the analysis needs: demographics, every effort rating, NASA-TLX (and raw TLX mean), Likert items, and summary scores per round (warm-up, practice and solo accuracy; asked-AI, tried-before-asking and copied-AI rates; wrong answers told and accepted; re-test, transfer and source-memory scores; the wrong-answer acceptance rate *when told*; follow-up speed; tutor retries and fallbacks). Practice accuracy leaves out the wrong-answer checks. Demo sessions are left out of every export.

Participant IDs (`P001`, `P002`, ...) come from the server, so they never clash across laptops. Demo sessions are `DEMO1`, `DEMO2`, .... Auto-assign puts each new participant in the group with the fewest sessions so far, not counting excluded, aborted or demo ones, and cycles question orders within each group.

## Still open

These need people, not code:

- [x] Choose the AI provider and get an API key (Groq, `openai/gpt-oss-120b`)
- [ ] Proofread every question in [QUESTION_SHEET.md](QUESTION_SHEET.md); swap in a spare for any that is unclear
- [ ] Install Node on the server laptop and run `npm run check` there, then a demo session from a second laptop
- [ ] Pilot with 2–3 people: time a full session (37 questions); set `practicePerRound` to 4 if it runs well over 35 minutes
- [ ] Confirm with the instructor whether the wrong-answer checks need ethics sign-off
- [ ] Decide who owns each task in the plan's task list
