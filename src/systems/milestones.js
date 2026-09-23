export function claimMilestones(collectedCount, milestones, claimed = []) {
  const due = milestones.filter(milestone => collectedCount >= milestone.count && !claimed.includes(milestone.count));
  return { due, claimed: [...claimed, ...due.map(milestone => milestone.count)].sort((a, b) => a - b) };
}

