// Vercel Serverless API Route: /api/ai/challenge
// Manages the Daily Challenge: AIs post daily prompts, visitors submit entries, Critic declares winners.

const { getDocument, setDocument, updateDocument, listDocuments, queryCollection } = require("../lib/firestore-rest.js");
const { callGemini, callGroq } = require("../lib/ai-clients.js");

const PROMPT_TEMPLATES = [
  "Caption this face like it's the climax of a low-budget action movie.",
  "What thought just crossed their mind at 3:17 AM?",
  "Give this face an official superhero (or villain) alter ego.",
  "Worst pose of the day: Write their exact inner monologue.",
  "Explain what sound this face makes without using words.",
  "The look when you open the fridge for the 4th time hoping new snacks spawned."
];

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const docId = `challenge_${todayStr}`;

    let challenge = await getDocument("daily_challenge", docId);

    if (!challenge) {
      // Pick a featured face from gallery
      const allFaces = await listDocuments("faces", 25);
      const candidates = allFaces.filter(f => !f.ai_disabled);
      const featuredFace = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : { id: "demo", name: "Surprised Bob", expression: "Jaw-Drop", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600" };

      const chosenPrompt = PROMPT_TEMPLATES[Math.floor(Math.random() * PROMPT_TEMPLATES.length)];

      challenge = {
        id: docId,
        date: todayStr,
        prompt: chosenPrompt,
        postedBy: Math.random() < 0.6 ? "Gossip" : "Critic",
        faceId: featuredFace.id,
        faceName: featuredFace.name,
        faceImage: featuredFace.image,
        faceExpression: featuredFace.expression,
        status: "active",
        winnerVerdict: null,
        createdAt: new Date().toISOString()
      };

      await setDocument("daily_challenge", docId, challenge);

      // Try to judge yesterday's challenge if active
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const yesterdayId = `challenge_${yesterday}`;
      const yesterdayChallenge = await getDocument("daily_challenge", yesterdayId);

      if (yesterdayChallenge && yesterdayChallenge.status === "active") {
        // Find top comments
        const comments = await queryCollection("face_comments", {
          whereEqual: [["faceId", yesterdayChallenge.faceId]],
          limit: 10
        });

        const humanComments = comments.filter(c => c.author_type !== "ai");
        if (humanComments.length > 0) {
          // Sort by likes
          humanComments.sort((a, b) => (b.likes || 0) - (a.likes || 0));
          const winningComment = humanComments[0];

          yesterdayChallenge.winnerWinner = winningComment.sender || "Anonymous";
          yesterdayChallenge.winnerComment = winningComment.text;
          yesterdayChallenge.winnerVerdict = `Critic's Verdict: "${winningComment.sender}" took the crown with ruthless comedic accuracy. A solid 9.4/10 performance.`;
          yesterdayChallenge.status = "judged";

          await updateDocument("daily_challenge", yesterdayId, {
            status: "judged",
            winnerName: yesterdayChallenge.winnerWinner,
            winnerComment: yesterdayChallenge.winnerComment,
            winnerVerdict: yesterdayChallenge.winnerVerdict
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      challenge
    });
  } catch (err) {
    console.error("API /api/ai/challenge error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
