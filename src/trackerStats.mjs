export const trackerStages = ['Interested', 'Applied', 'Interview', 'Offer', 'Closed'];
export function trackerStats(applications, today) {
  const stages = Object.fromEntries(trackerStages.map(stage => [stage, 0]));
  let due = 0;
  for (const item of applications) {
    if (Object.hasOwn(stages, item.stage)) stages[item.stage]++;
    if (item.followUp && item.followUp <= today && item.stage !== 'Closed' && item.stage !== 'Offer') due++;
  }
  return {total: applications.length, due, inProgress: stages.Applied + stages.Interview, stages};
}
