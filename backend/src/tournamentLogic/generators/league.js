export const generateLeagueFixtures = async (tournament, participants) => {
  const { _id: tournamentId } = tournament;
  const isDouble = tournament.settings?.rounds === "double";
  const baseFixtures = generateSingleRoundRobin(participants, tournamentId);

  if (!isDouble) return baseFixtures;

  // Reverse home/away for second round
  const maxMatchday = Math.max(...baseFixtures.map((f) => f.matchday));
  const reversed = baseFixtures.map((fixture) => ({
    ...fixture,
    matchday: fixture.matchday + maxMatchday,
    homeTeam: fixture.awayTeam,
    awayTeam: fixture.homeTeam,
  }));

  return [...baseFixtures, ...reversed];
};

// Single Round-Robin Algorithm
const generateSingleRoundRobin = (participants, tournamentId) => {
  const fixtures = [];
  const n = participants.length;
  const hasOdd = n % 2 !== 0;
  const teams = hasOdd ? [...participants, null] : participants;
  const totalRounds = teams.length - 1;
  let matchday = 1;

  for (let round = 0; round < totalRounds; round++) {
    for (let i = 0; i < teams.length / 2; i++) {
      const home = teams[i];
      const away = teams[teams.length - 1 - i];

      if (home && away) {
        fixtures.push({
          tournamentId,
          matchday,
          homeTeam: home,
          awayTeam: away,
          type: "league",
        });
      }
    }

    // rotate teams (except first)
    teams.splice(1, 0, teams.pop());
    matchday++;
  }

  return fixtures;
};
