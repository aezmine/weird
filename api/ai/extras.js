// Vercel Serverless API Route: /api/ai/extras
// Generates and caches vibe line, 3 auto tags, Critic score with reason, and "Looks like..." comparison.

const { getDocument, updateDocument } = require("../lib/firestore-rest.js");
const { callGemini, callGroq } = require("../lib/ai-clients.js");
const { checkGlobalCapAndStatus, recordAICall } = require("../lib/rate-limiter.js");

function extractJson(rawText) {
  if (!rawText) return null;
  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

function trimWords(str, maxWords) {
  if (!str) return "";
  const words = str.trim().split(/\s+/);
  return words.slice(0, maxWords).join(" ");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { faceId, forceRegenerate = false } = req.body || {};

    if (!faceId) {
      res.status(400).json({ error: "Missing faceId" });
      return;
    }

    const face = await getDocument("faces", faceId);
    if (!face) {
      res.status(404).json({ error: "Face not found" });
      return;
    }

    // Return cached extras if already generated and not forced
    if (face.ai_extras && !forceRegenerate) {
      res.status(200).json({
        success: true,
        cached: true,
        extras: face.ai_extras
      });
      return;
    }

    // Check cap
    const capCheck = await checkGlobalCapAndStatus();
    if (!capCheck.allowed && !forceRegenerate) {
      res.status(200).json({
        success: false,
        message: capCheck.reason
      });
      return;
    }

    const prompt = `Analyze this funny moment from MinWTF:
Title: "${face.name || "Funny Face"}"
Expression/Mood: "${face.expression || "Weird"}"
Caption: "${face.caption || ""}"
Visual Notes: "${face.ai_description || ""}"

Generate hilarious, witty AI extras following these STRICT rules:
1. "vibeLine": A punchy subtitle under the title (MAXIMUM 8 WORDS).
2. "autoTags": Array of exactly 3 short cultural or mood tags (e.g. ["snack energy", "side-eye", "main character"]).
3. "criticScore": A decimal score out of 10 between "7.0" and "9.9" (e.g. "8.7").
4. "criticReason": Exactly ONE witty sentence justifying the score (max 18 words).
5. "looksLike": A kind, silly, absurd comparison (movie character, food item, or animal, e.g. "A sleepy detective who solved the wrong case"). Never insult physical bodies or skin.

Respond ONLY with valid JSON in this exact structure (no markdown, no backticks):
{
  "vibeLine": "Mastermind of the 3 PM snack heist",
  "autoTags": ["snack energy", "side-eye", "main character"],
  "criticScore": "8.8",
  "criticReason": "Unrivalled commitment to the drama of misplaced pastries.",
  "looksLike": "A detective surprised by his own reflection"
}`;

    let parsed = null;
    let attempts = 0;

    while (attempts < 2 && !parsed) {
      attempts++;
      try {
        let rawText = "";
        try {
          rawText = await callGemini({ prompt, temperature: 0.7, maxTokens: 200 });
        } catch {
          rawText = await callGroq({
            systemPrompt: "You are an AI generating structured JSON for a comedy photo gallery.",
            userPrompt: prompt,
            maxTokens: 200
          });
        }
        parsed = extractJson(rawText);
      } catch (err) {
        console.warn(`Extras attempt ${attempts} failed:`, err.message);
      }
    }

    // Fallback if parsing failed
    if (!parsed || !parsed.vibeLine) {
      const defaultScores = ["8.2", "8.7", "9.1", "7.9", "8.5"];
      const score = defaultScores[Math.floor(Math.random() * defaultScores.length)];
      parsed = {
        vibeLine: trimWords(`${face.expression || "Unapologetic"} main character energy`, 8),
        autoTags: ["unhinged", "main character", (face.expression || "chaotic").toLowerCase().slice(0, 15)],
        criticScore: score,
        criticReason: "Demonstrates admirable commitment to questionable life decisions.",
        looksLike: "A French cinema protagonist contemplating an espresso"
      };
    }

    // Sanitize outputs
    const sanitizedExtras = {
      vibeLine: trimWords(parsed.vibeLine, 8),
      autoTags: Array.isArray(parsed.autoTags)
        ? parsed.autoTags.map(t => String(t).replace(/[#]/g, "").slice(0, 20)).slice(0, 3)
        : ["weird", "iconic", "unhinged"],
      criticScore: String(parsed.criticScore || "8.5").slice(0, 4),
      criticReason: trimWords(parsed.criticReason || "Immaculate dramatic presence.", 22),
      looksLike: trimWords(parsed.looksLike || "A dramatic sitcom hero", 15)
    };

    // Cache into Firestore face document
    await updateDocument("faces", faceId, {
      ai_extras: sanitizedExtras
    });

    await recordAICall(0.0002);

    res.status(200).json({
      success: true,
      cached: false,
      extras: sanitizedExtras
    });
  } catch (err) {
    console.error("API /api/ai/extras error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
