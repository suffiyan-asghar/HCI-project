// One row per participant: demographics, ratings and the summary scores each RQ uses.
// Rates are null when there was nothing to measure (e.g. AI columns for the control group).

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const rate = (items, test) => mean(items.map((x) => (test(x) ? 1 : 0)));
const round3 = (v) => (v === null ? null : Math.round(v * 1000) / 1000);

export function participantRows(sessions, getQuestion) {
  return sessions
    .filter((row) => row.session)
    .map(({ participant_id, grp, block_order, status, created_at, finished_at, session }) => {
      const byKind = (kind) => session.steps.map((step, i) => ({ step, r: session.responses[i] })).filter((x) => x.step.kind === kind && x.r);
      const answers = byKind('question');
      const demo = byKind('demographics')[0]?.r ?? {};
      const survey = byKind('questionnaire')[0]?.r ?? {};

      const row = {
        participant_id,
        group: grp,
        block_order,
        status,
        started_at: created_at,
        finished_at,
        minutes: finished_at ? round3((new Date(finished_at) - new Date(session.startedAt)) / 60000) : null,
        age: demo.age ?? null,
        gender: demo.gender ?? null,
        native_english: demo.nativeEnglish ?? null,
        ai_use: demo.aiUse ?? null,
        gre_last_year: demo.greLastYear ?? null,
      };

      for (const { r } of byKind('effort')) {
        row[`effort_${r.section}${r.round ? `_r${r.round}` : ''}`] = r.effort;
      }

      const accuracy = (filter) => round3(rate(answers.filter(filter), (x) => x.r.correct));
      row.acc_warmup = accuracy((x) => x.step.section === 'warmup');
      for (const round of [1, 2, 3]) {
        const practice = answers.filter((x) => x.step.section === 'practice' && x.step.round === round);
        // Planted questions are left out of practice accuracy: the tutor was wrong on purpose.
        const honest = practice.filter((x) => !x.step.planted);
        row[`acc_practice_r${round}`] = round3(rate(honest, (x) => x.r.correct));
        row[`acc_solo_r${round}`] = accuracy((x) => x.step.section === 'solo' && x.step.round === round);
        if (session.group !== 'control') {
          row[`asked_ai_r${round}`] = round3(rate(practice, (x) => x.r.askedAI));
          const asked = practice.filter((x) => x.r.askedAI);
          row[`tried_before_asking_r${round}`] = round3(rate(asked, (x) => x.r.triedBeforeAsking));
          const told = honest.filter((x) => x.r.aiStatedAnswer !== null && x.r.aiStatedAnswer !== undefined);
          row[`matched_ai_r${round}`] = round3(rate(told, (x) => x.r.matchedAI));
        }
      }

      const planted = answers.filter((x) => x.step.planted);
      const toldWrong = planted.filter((x) => x.r.aiStatedAnswer === getQuestion(x.step.qid)?.plantedWrong);
      row.planted_told_wrong = toldWrong.length;
      row.planted_accepted_wrong = planted.filter((x) => x.r.acceptedWrongAI).length;
      // Compare groups on this rate, not the raw count: Adaptive participants are told less often.
      row.planted_accept_rate_when_told = round3(rate(toldWrong, (x) => x.r.acceptedWrongAI));

      const retention = answers.filter((x) => x.step.section === 'retention');
      row.acc_retest_practice = accuracy((x) => x.step.retest === 'practice');
      row.acc_retest_solo = accuracy((x) => x.step.retest === 'solo');
      row.acc_transfer = accuracy((x) => x.step.retest === 'transfer');
      if (session.group !== 'control') {
        // Source memory: did they correctly remember whether StudyBot helped on that question?
        const judged = retention.filter((x) => x.r.sourceAnswer && x.r.sourceAnswer !== "Don't remember");
        row.source_memory_correct = round3(
          rate(judged, (x) => {
            const original = answers.find((a) => a.step.qid === x.step.qid && a.step.section === x.step.retest);
            return (x.r.sourceAnswer === 'Yes') === Boolean(original?.r.askedAI);
          }),
        );
      }

      for (const [key, value] of Object.entries(survey.tlx ?? {})) row[`tlx_${key}`] = value;
      row.tlx_raw = round3(mean(Object.values(survey.tlx ?? {})));
      for (const [key, value] of Object.entries(survey.likert ?? {})) row[`likert_${key}`] = value;
      row.noticed_wrong = survey.noticedWrong ?? null;
      row.comments = survey.comments ?? null;

      const botMessages = answers.flatMap((x) => (x.r.messages ?? []).filter((m) => m.role === 'bot'));
      row.tutor_replies = botMessages.length;
      row.tutor_retried_replies = botMessages.filter((m) => m.note?.startsWith('retried')).length;
      row.tutor_fallback_replies = botMessages.filter((m) => m.source === 'fallback').length;

      // Follow-ups: how fast people asked again after a reply. Very short gaps suggest
      // clicking through hints to reach the answer instead of reading them.
      const gaps = answers.flatMap((x) =>
        (x.r.messages ?? []).flatMap((m, i, all) => (m.role === 'user' && i > 0 && all[i - 1].role === 'bot' ? [(m.t - all[i - 1].t) / 1000] : [])),
      );
      row.followups = gaps.length;
      row.mean_followup_gap_s = round3(mean(gaps));
      return row;
    });
}
