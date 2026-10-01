// Vercel Serverless API Route: /api/ai/mood
// Today's Mood banner: Gossip writes a one-line 24hr recap of site chaos.

const { getDocument, setDocument, listDocuments } = require("../lib/firestore-rest.js");
const { callGemini, callGroq } = require("../lib/ai-clients.js");

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
    const docId = `mood_${todayStr}`;

    const existing = await getDocument("daily_mood", docId);
    const now = Date.now();

    // Cache for 4 hours
    if (existing && existing.updatedAt && (now - new Date(existing.updatedAt).getTime() < 4 * 3600 * 1000)) {
      res.status(200).json({
        success: true,
        cached: true,
        mood: existing.moodText
      });
      return;
    }

    // Gather site stats from last 24h
    const faces = await listDocuments("faces", 15);
    const topFace = faces.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))[0];
    const totalFaces = faces.length;

    const prompt = `You are Gossip, the hype AI resident on MinWTF.
Write a ONE-LINE (max 18 words) daily mood summary of what's happening on the site:
- Total weird faces in gallery: ${totalFaces}
- Hottest face right now: "${topFace ? topFace.name : "Mystery Hero"}" (${topFace ? topFace.expression : "Chaotic"})
- Mood: High energy, playful banter, hilarious expressions.

Format: "Today's vibe: [punchy 1-line recap by Gossip]". Max 1 emoji. Zero hashtags.`;

    let moodText = "";
    try {
      moodText = await callGemini({ prompt, maxTokens: 80 });
    } catch {
      try {
        moodText = await callGroq({
          systemPrompt: "You are Gossip on MinWTF.",
          userPrompt: prompt,
          maxTokens: 80
        });
      } catch {}
    }

    if (!moodText || moodText.length < 5) {
      moodText = `Today's vibe: ${totalFaces} unhinged faces in the vault, "${topFace ? topFace.name : "everyone"}" running the leaderboard! ✨`;
    }

    // Clean up
    moodText = moodText.replace(/^["]|["]$/g, "").replace(/#[a-zA-Z0-9_]+/g, "").trim();

    await setDocument("daily_mood", docId, {
      moodText,
      updatedAt: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      cached: false,
      mood: moodText
    });
  } catch (err) {
    console.error("API /api/ai/mood error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
