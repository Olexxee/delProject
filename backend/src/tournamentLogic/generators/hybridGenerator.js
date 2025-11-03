import { generateSingleRoundRobin } from "./league.js";

// HYBRID GENERATOR — Group + Knockout
export const generateHybridFixtures = async (tournament, participants) => {
  const fixtures = [];
  const { _id: tournamentId } = tournament;

  // 1️⃣ Group Stage
  const groupSize = 4;
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const groups = [];

  for (let i = 0; i < shuffled.length; i += groupSize) {
    groups.push(shuffled.slice(i, i + groupSize));
  }

  let offset = 0;
  groups.forEach((groupTeams, index) => {
    const groupFixtures = generateSingleRoundRobin(
      groupTeams,
      tournamentId
    ).map((f) => ({
      ...f,
      group: `Group ${index + 1}`,
      matchday: f.matchday + offset,
      type: "group",
    }));
    fixtures.push(...groupFixtures);
    offset += Math.max(...groupFixtures.map((f) => f.matchday));
  });

  // 2️⃣ Knockout Placeholder (advance after group stage)
  fixtures.push({
    tournamentId,
    type: "knockout_placeholder",
    matchday: offset + 1,
  });

  return fixtures;
};
