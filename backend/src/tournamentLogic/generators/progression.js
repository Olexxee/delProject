// -----------------------------
// CUP TOURNAMENT PROGRESSION
// -----------------------------
export const handleCupProgression = async (fixture, tournament) => {
  const currentRound = fixture.round;

  // Get all fixtures for this round
  const roundFixtures = await fixtureDb.getFixturesByRound(
    tournament._id,
    currentRound
  );

  // Ensure all are completed before moving to next round
  const allCompleted = roundFixtures.every((f) => f.isCompleted);
  if (!allCompleted)
    return { message: `Round ${currentRound} not yet completed` };

  // Collect winners from this round
  const winners = roundFixtures
    .filter((f) => !f.bye)
    .map((f) => (f.homeScore > f.awayScore ? f.homeTeam : f.awayTeam));

  // Handle bye winners
  const byeWinners = roundFixtures.filter((f) => f.bye).map((f) => f.homeTeam);

  const advancingTeams = [...winners, ...byeWinners];

  // If only one team remains — Tournament finished
  if (advancingTeams.length === 1) {
    await tournamentDb.updateTournament(tournament._id, {
      status: "completed",
    });

    // Notify participants
    await notificationService.createNotification({
      user: advancingTeams[0],
      type: "tournament_winner",
      message: `🏆 You have won the ${tournament.name} Cup Tournament!`,
      referenceId: tournament._id,
    });

    io.emit("tournament:completed", {
      tournamentId: tournament._id,
      winner: advancingTeams[0],
    });

    return { message: "Tournament completed", winner: advancingTeams[0] };
  }

  // Generate next round
  const nextRound = currentRound + 1;
  const nextFixtures = [];
  for (let i = 0; i < advancingTeams.length; i += 2) {
    if (i + 1 < advancingTeams.length) {
      nextFixtures.push({
        tournamentId: tournament._id,
        round: nextRound,
        matchday: nextRound,
        homeTeam: advancingTeams[i],
        awayTeam: advancingTeams[i + 1],
        type: "cup",
      });
    } else {
      nextFixtures.push({
        tournamentId: tournament._id,
        round: nextRound,
        matchday: nextRound,
        homeTeam: advancingTeams[i],
        bye: true,
        type: "cup",
      });
    }
  }

  // Save fixtures
  await fixtureDb.createFixtures(nextFixtures);

  io.emit("tournament:nextRound", {
    tournamentId: tournament._id,
    round: nextRound,
    fixtures: nextFixtures,
  });

  return { message: `Next round (${nextRound}) generated successfully.` };
};

// -----------------------------
// HYBRID TOURNAMENT PROGRESSION
// -----------------------------
export const handleHybridProgression = async (fixture, tournament) => {
  // Handle group stage completion
  const groupFixtures = await fixtureDb.getFixturesByType(
    tournament._id,
    "group"
  );

  const allGroupsCompleted = groupFixtures.every((f) => f.isCompleted);

  if (allGroupsCompleted) {
    // Compute top teams from each group (simplified)
    const groupStats = await tableService.computeGroupStandings(tournament._id);
    const qualifiedTeams = [];

    for (const group of Object.keys(groupStats)) {
      // Take top 2 from each group
      qualifiedTeams.push(
        ...groupStats[group].slice(0, 2).map((t) => t.teamId)
      );
    }

    // Create first knockout fixtures (Quarterfinals, etc)
    const knockoutFixtures = [];
    const shuffled = qualifiedTeams.sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        knockoutFixtures.push({
          tournamentId: tournament._id,
          round: 1,
          matchday: groupFixtures.length + 1,
          homeTeam: shuffled[i],
          awayTeam: shuffled[i + 1],
          type: "cup",
        });
      }
    }

    await fixtureDb.createFixtures(knockoutFixtures);

    // Update tournament phase
    await tournamentDb.updateTournament(tournament._id, { phase: "knockout" });

    io.emit("tournament:phaseChange", {
      tournamentId: tournament._id,
      phase: "knockout",
    });

    return { message: "Knockout phase started", fixtures: knockoutFixtures };
  }

  // If already in knockout phase, behave like cup progression
  if (tournament.phase === "knockout") {
    return await _handleCupProgression(fixture, tournament);
  }

  return { message: "Awaiting completion of all group fixtures" };
};
