# StudyBot Build Plan

How we will build the StudyBot app for the Phase 1 study described in [plan_hci_project.pdf](plan_hci_project.pdf).

- **Phase 1 submission:** October 25 (running app + experimental plan)
- **Pilot:** October 23–24
- **Data collection:** October 26–28

## Decisions made

| Topic | Decision |
|---|---|
| Stack | React frontend (Vite) + Node/Express server + SQLite, in one repo |
| Hosting | One laptop runs the server; the other 3–4 study laptops open `http://<host-ip>:3000` on the same Wi-Fi |
| Data | Everything goes into a single SQLite file on the host laptop; the admin page exports CSV |
| AI provider | Not decided. The AI call sits behind one small module. Claude is wired first, plus a **mock mode** with canned replies, so we can build and pilot without an API key |
| Questions | Claude drafts 44 original GRE-style verbal questions (28 main + 16 spares); the team proofreads them |

## What one participant goes through

```
Consent + demographics  (~2 min)
Warm-up: 4 questions, no AI                 -> effort rating
Round 1: Practice 5 (with tutor) -> Solo 3   -> effort rating after each
Round 2: Practice 5 (with tutor) -> Solo 3   -> effort rating after each
Round 3: Practice 5 (with tutor) -> Solo 3   -> effort rating after each
Final questionnaire: NASA-TLX, trust, reliance
Debrief: reveals the 2 wrong-answer questions
```

That is 4 + 15 + 9 = 28 questions, about 30 minutes. The two groups differ **only** in the practice steps.

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

**Wrong-answer checks.** On 2 of the 15 practice questions, any full answer the tutor gives is a plausible but wrong one. The server decides which option the tutor must explain and passes it to the model; the model never picks the answer itself. The debrief names these questions.

## Question bank

Questions live in a JSON file, separate from the app code, so proofreading edits never touch logic. Each question has:

- `id`, `type` (`blank` | `logic` | `reading`), optional `passage`
- `stem`, `options`, `correct`
- `plantedWrong`: the plausible wrong option used on wrong-answer-check questions
- `hint`: a hint that rules out wrong options

Question sets are rotated across rounds by participant so that difficulty is balanced. Each set mixes the three question types.

## What we log

Every event is stored against a participant ID (no names):

- Group, question set order, timestamps for every screen
- Each answer: selected option, correct or not, time on question
- Whether the student picked an option **before** opening the chat. We log this for **both** groups, otherwise RQ2 ("do they try before asking?") cannot be measured for the Standard group
- Every chat message, its help level, and the answer the AI stated
- Whether the final answer matches the AI's stated answer (copying the AI / accepting a wrong answer)
- Effort ratings (1–10), NASA-TLX, trust and reliance answers, demographics

## Build steps

| Step | What | Done when |
|---|---|---|
| 1 | Scaffold: Vite React + Express + SQLite; `npm run dev` for development, `npm start` to serve on the LAN | The blank app loads from another laptop on the same Wi-Fi |
| 2 | Question bank JSON + 44 drafted questions + set rotation | Sets are balanced by question type across rounds |
| 3 | Session flow from consent to debrief, with effort ratings and resume after a page refresh | Can click through all 28 questions without AI |
| 4 | Tutor engine: Standard and Adaptive, guess-first, escalation, wrong-answer checks, mock mode | Both groups behave as in the tutor table above, in mock mode |
| 5 | Event logging | Every action appears in the database |
| 6 | Admin page: participant list, group balance, CSV export | The export opens cleanly in Excel or R |
| 7 | Hardening: fallback when the AI call fails, config file, demo mode for the recording | Ready for the pilot |

**Steps 1–4 are the minimum for the October 25 submission. Steps 5–7 must be done before data collection on October 26.**

## Still open

- [ ] Choose the AI provider and get an API key
- [ ] Proofread the 44 drafted questions and their answers
- [ ] Confirm with the instructor whether the wrong-answer checks need ethics sign-off
- [ ] Decide who owns each task in the plan's task list
