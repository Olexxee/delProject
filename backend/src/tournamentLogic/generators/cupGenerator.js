export const generateCupFixtures = async (tournament, participants) => {
  const fixtures = [];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const { _id: tournamentId } = tournament;

  let round = 1;
  let currentTeams = shuffled;

  while (currentTeams.length > 1) {
    const nextRound = [];

    for (let i = 0; i < currentTeams.length; i += 2) {
      if (i + 1 < currentTeams.length) {
        fixtures.push({
          tournamentId,
          round,
          matchday: round,
          homeTeam: currentTeams[i],
          awayTeam: currentTeams[i + 1],
          type: "cup",
        });
        nextRound.push("winner_" + fixtures.length); // placeholder
      } else {
        // Bye
        fixtures.push({
          tournamentId,
          round,
          matchday: round,
          homeTeam: currentTeams[i],
          bye: true,
          type: "cup",
        });
        nextRound.push(currentTeams[i]);
      }
    }

    currentTeams = nextRound;
    round++;
  }

  return fixtures;
};
