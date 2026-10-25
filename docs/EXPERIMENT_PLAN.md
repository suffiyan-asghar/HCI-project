# Experiment Plan: StudyBot

**Does easy AI help lower effort at the cost of what students retain, and can an adaptive tutor keep the benefit without the cost?**

Rashid Hussain, Uzair Ahmed, Suffyan Asghar · Human-Computer Interaction, Final Project

This plan replaces `plan_hci_project.pdf` (October 22). What changed and why is listed at the end.

| Date | Step |
|---|---|
| October 25 | Phase 1: running app and this plan |
| October 26–28 | Data collection |
| October 29–31 | Analysis and write-up |
| November 1 | Phase 2 submission |

## Background

Srinivasaprasad et al. (2026) found that concise, structured AI answers ("Standard" style) gave students the lowest mental effort and the highest accuracy on GRE-style verbal questions. Their chatbot was scripted (Wizard-of-Oz) and tested in a single exposure, so it could not show whether that low-effort help also reduces what students can do on their own afterwards. We test that with a real AI tutor, a retention check, and an adaptive alternative.

## Research questions

| | Question | Comparison |
|---|---|---|
| **RQ1** | Does a real AI tutor reduce mental effort, as the paper's scripted one did? | Warm-up (no AI) vs round 1 within the AI groups; AI groups vs no-AI control |
| **RQ2** | Does repeated answer-first help increase reliance and reduce what students retain and can transfer? | Standard group across rounds; Standard vs control on the final check; practice vs solo questions on the final check |
| **RQ3** | Can an adaptive tutor keep effort low while preserving retention and independent reasoning? | Standard vs Adaptive |

We frame RQ2 as **lower retention and transfer**, not memory loss or cognitive decline, which one session cannot show.

## Design

Between-subjects, three groups, with repeated rounds within each session. Participants are assigned by the server to whichever group has the fewest participants so far, so groups stay balanced across all laptops.

| Group | During practice questions |
|---|---|
| **Standard** | StudyBot gives the answer and a short reason straight away; follow-ups explain more |
| **Adaptive** | Student must pick a guess first (or tap "I have no idea yet"). The first reply depends on their accuracy on the last 4 questions answered without AI: below 50% → full answer; 50–74% → a hint that rules out options; 75%+ → a guiding question. Each follow-up gives more help; the answer is at most three messages away |
| **Control** | Same questions, no AI |

Everything else is identical across groups. Both AI tutors use the same style (short bullets with emojis, about 100 words), the same model (`openai/gpt-oss-120b` via Groq), and the same 6-second pause before a follow-up can be sent.

### One session (about 35 minutes)

```
Consent and demographics
Warm-up: 4 questions, no AI                                → effort rating
Round 1: 5 practice (group condition) → 3 solo (no AI)     → effort rating after each part
Round 2: same
Round 3: same
Questionnaire: NASA-TLX, trust and reliance items          (also a delay before the final check)
Final check: 9 questions, no AI
Debrief
```

The **final check** re-asks one practice and one solo question from each round, with the options reshuffled, plus 3 new **transfer** questions that use the same skills. On each re-asked question, the AI groups are also asked whether StudyBot helped them with it earlier (source memory).

Questions come in three blocks, each with the same mix of types (sentence completion, logical reasoning, short reading). Block order is rotated with a Latin square within each group, so every block appears in every round equally often.

**Wrong-answer checks.** On 2 of the 15 practice questions (fixed positions: round 1 question 4, round 3 question 2), any full answer the tutor gives is a plausible but wrong one. This measures whether students check the AI or accept it. These questions are never re-asked in the final check, and the debrief reveals them.

## Measures

| Measure | How | Used for |
|---|---|---|
| Mental effort | 1–10 rating after every part (same item as the paper) | RQ1, RQ3 |
| Workload | NASA-TLX (raw), once at the end | RQ1, RQ3 |
| Accuracy | Warm-up, practice (excluding wrong-answer checks), solo | RQ1–RQ3 |
| Asked the AI; tried before asking | Whether they chose an option before their first message (logged for both AI groups) | RQ2 |
| Copied the AI | Final answer matches the answer the AI stated | RQ2 |
| Accepted the wrong answer | On wrong-answer checks, **rate among those who were told the wrong answer** | RQ2, RQ3 |
| Retention | Final-check accuracy on re-asked practice and solo questions | RQ2, RQ3 |
| Transfer | Final-check accuracy on new questions | RQ2, RQ3 |
| Source memory | Correctly remembering whether StudyBot helped | RQ2 |
| Trust and reliance | 5-point items at the end | RQ2, RQ3 |
| Time and follow-ups | Time per question; how quickly follow-ups were sent | Secondary |

Eye tracking from the original paper is replaced by self-rated effort, NASA-TLX and timing, since we have no eye tracker.

## Participants

About **45 students (15 per group)**, one sitting each, 3–4 laptops in parallel. People who took the GRE in the past 12 months are excluded on screen and do not count towards group sizes.

## Analysis

- **RQ1:** paired comparison of warm-up vs round-1 effort within the AI groups (paired t-test or Wilcoxon); AI groups vs control on effort and NASA-TLX.
- **Accuracy, retention and transfer** are analysed **per answer**, not as per-person percentages: mixed-effects logistic regression with group, round (or question kind on the final check) and their interaction as fixed effects, and participant and question as random effects. Each person answers only 3 questions of each final-check kind, so per-answer models with random effects use the data much better than averages.
- **RQ2:** within the Standard group, change across rounds in tried-before-asking and copy rate (mixed-effects models with round as a factor); on the final check, practice vs solo questions, and Standard vs control.
- **RQ3:** Standard vs Adaptive on retention, transfer, effort and NASA-TLX, with the same models.
- **Wrong-answer acceptance:** compared only among participants who were actually told the wrong answer. Adaptive participants are told it less often, so raw counts would favour them unfairly.
- Data come from the app's `participants.csv` (one row per person) and `answers.csv` (one row per answer).

## Limitations

- **One session.** We can show early signs of reliance and lower retention, not long-term effects.
- **Small final check and small groups.** 9 final-check questions and about 15 people per group can only detect fairly large differences (for two groups of 15, roughly d ≈ 1). The per-answer models help, but null results should be read as inconclusive.
- **Exposure differs between practice and solo questions.** On practice questions the AI groups saw an explanation; on solo questions they did not. Lower retention of AI-helped questions is therefore partly about how the answer was reached, which is the point, but also about exposure.
- **Live AI varies.** Replies differ between participants. Every reply is checked against its help level before it is shown, and all replies are logged, but wording still varies.
- **Self-reported effort** replaces the paper's physiological measures.

## Ethics

Participation is voluntary with on-screen consent; data are stored under participant IDs only, never names; anyone can stop at any time. The wrong-answer checks are a mild deception: the consent screen says some details are explained at the end, and the debrief names the questions and the wrong answers given. **We are confirming with the instructor whether this needs ethics sign-off before data collection.**

## What changed from the October 22 plan

| Earlier plan | Now | Why |
|---|---|---|
| Two groups (Standard, Adaptive), ~30 students | Three groups with a no-AI control, ~45 students | A control is needed to show that AI help itself, not just practice, changes retention |
| Outcome: solo-check accuracy | Plus a final check with re-asked and new questions, and source memory | Measures what was retained and transferred, the core of RQ2 |
| 28 questions | 37 questions (28 + 9 in the final check) | Same main session, plus the final check |
| AI provider undecided | Groq, `openai/gpt-oss-120b` | |
| Slides mention 4–5 sessions | One session | Fits the timeline; stated as a limitation |
