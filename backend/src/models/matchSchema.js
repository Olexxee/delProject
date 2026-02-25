import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  score: {
    type: Number,
    default: 0,
  },
  goals: {
    type: Number,
    default: 0,
  },
  kills: {
    type: Number,
    default: 0,
  },
  isWinner: {
    type: Boolean,
    default: false,
  },
});

const matchSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
    },
    participants: [participantSchema],
    isClosed: {
      type: Boolean,
      default: false,
    },
    closedAt: Date,
    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    homeGoals: {
      type: Number,
      default: 0,
    },
    awayGoals: {
      type: Number,
      default: 0,
    },
    matchday: {
      type: Number,
    },
  },
  { timestamps: true },
);

// ADD POST-SAVE MIDDLEWARE FOR FIXTURE SYNC
matchSchema.post("save", async function (match) {
  // Only update when match is closed
  if (match.isClosed && match.isModified("isClosed")) {
    try {
      // Update fixture with match results
      const Fixture = (await import("./fixtureSchema.js")).default;

      // Find corresponding fixture
      const fixture = await Fixture.findOne({
        tournamentId: match.tournamentId,
        $or: [
          {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
          },
          {
            homeTeam: match.awayTeam,
            awayTeam: match.homeTeam,
          },
        ],
      });

      if (fixture) {
        // Update fixture with results
        await Fixture.findByIdAndUpdate(fixture._id, {
          homeGoals: match.homeGoals,
          awayGoals: match.awayGoals,
          homeScore: match.homeGoals,
          awayScore: match.awayGoals,
          isCompleted: true,
          completedAt: new Date(),
          status: "completed",
          matchId: match._id,
        });

        console.log(
          `🏟️ Fixture updated: ${match.homeGoals}-${match.awayGoals}`,
        );
      }

      // Update participant stats
      const { updateParticipantStats } =
        await import("../tournamentLogic/participantService.js");
      await updateParticipantStats({
        matchId: match._id,
        tournamentId: match.tournamentId,
        participants: match.participants,
      });
    } catch (error) {
      console.error("Error updating match results:", error);
    }
  }
});

export default mongoose.model("Match", matchSchema);
