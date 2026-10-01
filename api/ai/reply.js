// Vercel Serverless API Route: /api/ai/reply
// Handles visitor comment replies (probabilistic) and short AI-to-AI banter threads (max 3 messages).

const { getDocument, addDocument, updateDocument, queryCollection } = require("../lib/firestore-rest.js");
const { generateAIResponse } = require("../lib/ai-clients.js");
const { getAIMemory, recordAIComment } = require("../lib/memory.js");
const { checkGlobalCapAndStatus, recordAICall } = require("../lib/rate-limiter.js");

const AVATARS = {
  gossip: "https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/ttanlankvxliwxh1potw.jpg",
  critic: "https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/kioa9cgrappuxay0emgt.jpg"
};

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
    const {
      faceId,
      commentId,
      commentText,
      visitorName = "Visitor"
    } = req.body || {};

    if (!faceId || !commentText) {
      res.status(400).json({ error: "Missing required parameters" });
      return;
    }

    // 1. Cap and status check
    const capCheck = await checkGlobalCapAndStatus();
    if (!capCheck.allowed) {
      res.status(200).json({ skipped: true, reason: capCheck.reason });
      return;
    }

    const settings = capCheck.settings || {};
    const replyProbability = typeof settings.reply_probability === "number" ? settings.reply_probability : 0.60;

    // Check probability roll
    if (Math.random() > replyProbability) {
      res.status(200).json({ skipped: true, reason: "Probability threshold not triggered" });
      return;
    }

    // 2. Fetch face data
    const face = await getDocument("faces", faceId);
    if (!face || face.ai_disabled) {
      res.status(200).json({ skipped: true, reason: "Face AI disabled or not found" });
      return;
    }

    // 3. Choose AI based on visitor comment tone
    const lower = commentText.toLowerCase();
    let chosenAI = "gossip";
    if (lower.includes("rate") || lower.includes("score") || lower.includes("why") || lower.includes("judge") || lower.includes("critic") || lower.includes("think")) {
      chosenAI = "critic";
    } else if (lower.includes("hype") || lower.includes("gossip") || lower.includes("lol") || lower.includes("lmao") || lower.includes("wild")) {
      chosenAI = "gossip";
    } else {
      chosenAI = Math.random() < 0.5 ? "gossip" : "critic";
    }

    const aiMem = await getAIMemory(chosenAI);
    const replyOutput = await generateAIResponse(chosenAI, {
      task: "reply",
      face,
      userComment: commentText,
      visitorName,
      memory: aiMem
    });

    const aiCommentDoc = await addDocument("face_comments", {
      faceId,
      faceName: face.name || "Funny Face",
      text: replyOutput.text,
      sender: chosenAI === "critic" ? "Critic" : "Gossip",
      avatar: AVATARS[chosenAI],
      author_type: "ai",
      ai_id: chosenAI,
      badge: "AI",
      reply_to: commentId || null,
      likes: 0,
      reactions: {},
      createdAt: new Date().toISOString()
    });

    await recordAIComment(chosenAI, {
      text: replyOutput.text,
      opening: replyOutput.opening,
      faceId,
      nickname: face.ai_nickname
    });
    await recordAICall();

    const commentsIncrement = typeof face.commentsCount === "number" ? face.commentsCount + 1 : 1;
    await updateDocument("faces", faceId, { commentsCount: commentsIncrement });

    // 4. Check for optional AI-to-AI banter (max 3 banter messages per face)
    let banterDoc = null;
    const existingComments = await queryCollection("face_comments", {
      whereEqual: [["faceId", faceId]],
      limit: 20
    });

    const existingBanterCount = existingComments.filter(c => c.is_ai_banter).length;
    const shouldBanter = existingBanterCount < 3 && Math.random() < 0.35;

    if (shouldBanter) {
      const otherAI = chosenAI === "gossip" ? "critic" : "gossip";
      const otherMem = await getAIMemory(otherAI);

      const banterPrompt = `You are ${otherAI === "critic" ? "Critic" : "Gossip"}.
Your fellow resident ${chosenAI === "critic" ? "Critic" : "Gossip"} just said under face "${face.name}":
"${replyOutput.text}"

Give a snappy, hilarious 1-line reaction directly to what they just said. Stay in your ${otherAI} persona. Max 140 chars. Max 1 emoji. No hashtags.`;

      const banterOutput = await generateAIResponse(otherAI, {
        task: "reply",
        face,
        customPrompt: banterPrompt,
        memory: otherMem
      });

      banterDoc = await addDocument("face_comments", {
        faceId,
        faceName: face.name || "Funny Face",
        text: banterOutput.text,
        sender: otherAI === "critic" ? "Critic" : "Gossip",
        avatar: AVATARS[otherAI],
        author_type: "ai",
        ai_id: otherAI,
        badge: "AI",
        is_ai_banter: true,
        reply_to: aiCommentDoc.id,
        likes: 0,
        reactions: {},
        createdAt: new Date(Date.now() + 3000).toISOString()
      });

      await recordAIComment(otherAI, {
        text: banterOutput.text,
        opening: banterOutput.opening,
        faceId
      });
      await recordAICall();
      await updateDocument("faces", faceId, { commentsCount: commentsIncrement + 1 });
    }

    res.status(200).json({
      success: true,
      reply: aiCommentDoc,
      banter: banterDoc
    });
  } catch (err) {
    console.error("API /api/ai/reply error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
