// Vercel Serverless API Route: /api/ai/chat
// Handles Live Chat AI residents: @mentions, greetings, face alerts, and idle chatter.

const { getDocument, addDocument, listDocuments } = require("../lib/firestore-rest.js");
const { generateAIResponse } = require("../lib/ai-clients.js");
const { getAIMemory, recordAIComment } = require("../lib/memory.js");
const { checkGlobalCapAndStatus, recordAICall } = require("../lib/rate-limiter.js");

const AVATAR_GOSSIP = "https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/ttanlankvxliwxh1potw.jpg";
const AVATAR_CRITIC = "https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/kioa9cgrappuxay0emgt.jpg";

let lastIdleTopicTime = 0;

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
      action = "mention", // "mention" | "greet" | "face_reaction" | "idle_topic"
      text = "",
      sender = "Visitor",
      faceId = null,
      faceName = null,
      humanOnlineCount = 1
    } = req.body || {};

    // 1. Cap check
    const capCheck = await checkGlobalCapAndStatus();
    if (!capCheck.allowed) {
      res.status(200).json({ skipped: true, reason: capCheck.reason });
      return;
    }

    // 2. Mentions handler (@Gossip or @Critic)
    if (action === "mention") {
      const lower = text.toLowerCase();
      const mentionsGossip = lower.includes("@gossip");
      const mentionsCritic = lower.includes("@critic");

      if (!mentionsGossip && !mentionsCritic) {
        res.status(200).json({ skipped: true, reason: "No AI mentioned" });
        return;
      }

      const targetAI = mentionsCritic && !mentionsGossip ? "critic" : "gossip";
      const aiMem = await getAIMemory(targetAI);

      const prompt = `Live chat message from ${sender}: "${text}".
You are ${targetAI === "critic" ? "Critic (deadpan, dry humour, scoring)" : "Gossip (hype friend, dramatic, funny)"}.
Respond directly to ${sender} in live chat. Keep it under 150 characters. Max 1 emoji. Zero hashtags.`;

      const aiRes = await generateAIResponse(targetAI, {
        task: "chat",
        customPrompt: prompt,
        visitorName: sender,
        memory: aiMem
      });

      const chatMsg = await addDocument("chat_messages", {
        text: aiRes.text,
        sender: targetAI === "critic" ? "Critic" : "Gossip",
        avatar: targetAI === "critic" ? AVATAR_CRITIC : AVATAR_GOSSIP,
        author_type: "ai",
        ai_id: targetAI,
        badge: "AI",
        likes: 0,
        createdAt: new Date().toISOString()
      });

      await recordAIComment(targetAI, { text: aiRes.text, opening: aiRes.opening });
      await recordAICall();

      res.status(200).json({ success: true, message: chatMsg });
      return;
    }

    // 3. Greet new visitor
    if (action === "greet") {
      const targetAI = Math.random() < 0.6 ? "gossip" : "critic";
      const aiMem = await getAIMemory(targetAI);

      const prompt = targetAI === "gossip"
        ? `A new visitor "${sender}" just joined the MinWTF live chat! Give them a dramatic, hilarious welcome and bestow a silly nickname upon them. Max 120 chars. Max 1 emoji. No hashtags.`
        : `A new visitor "${sender}" just entered the chat. Acknowledge their arrival with deadpan, dry humour. Max 120 chars. Max 1 emoji. No hashtags.`;

      const aiRes = await generateAIResponse(targetAI, {
        task: "chat",
        customPrompt: prompt,
        visitorName: sender,
        memory: aiMem
      });

      const chatMsg = await addDocument("chat_messages", {
        text: aiRes.text,
        sender: targetAI === "critic" ? "Critic" : "Gossip",
        avatar: targetAI === "critic" ? AVATAR_CRITIC : AVATAR_GOSSIP,
        author_type: "ai",
        ai_id: targetAI,
        badge: "AI",
        likes: 0,
        createdAt: new Date().toISOString()
      });

      await recordAIComment(targetAI, { text: aiRes.text, opening: aiRes.opening });
      await recordAICall();

      res.status(200).json({ success: true, message: chatMsg });
      return;
    }

    // 4. React to newly added face in chat
    if (action === "face_reaction") {
      if (!faceId || !faceName) {
        res.status(400).json({ error: "Missing face details" });
        return;
      }

      const prompt = `A hilarious new face just got added to the gallery: "${faceName}".
Drop an urgent, funny 1-line announcement in live chat urging visitors to go look at it. Max 130 chars. Max 1 emoji. No hashtags.`;

      const aiRes = await generateAIResponse("gossip", {
        task: "chat",
        customPrompt: prompt,
        face: { id: faceId, name: faceName }
      });

      const chatMsg = await addDocument("chat_messages", {
        text: aiRes.text,
        sender: "Gossip",
        avatar: AVATAR_GOSSIP,
        author_type: "ai",
        ai_id: "gossip",
        badge: "AI",
        faceId,
        faceName,
        likes: 0,
        createdAt: new Date().toISOString()
      });

      await recordAIComment("gossip", { text: aiRes.text, opening: aiRes.opening, faceId });
      await recordAICall();

      res.status(200).json({ success: true, message: chatMsg });
      return;
    }

    // 5. Idle chatter topic starter (at most once every 10 min, never when 0 humans online)
    if (action === "idle_topic") {
      if (humanOnlineCount <= 0) {
        res.status(200).json({ skipped: true, reason: "No humans online" });
        return;
      }

      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      if (now - lastIdleTopicTime < tenMinutes) {
        res.status(200).json({ skipped: true, reason: "10-minute idle rate limit active" });
        return;
      }

      const topics = [
        "Debate of the day: Which face in the gallery is the secret final boss?",
        "If your face had a warning label right now, what would it say?",
        "Pop quiz: Is it better to look suspicious or completely confused on camera?",
        "Critic and I are judging expressions today. What’s the weirdest face you pulled this week?",
        "Quick poll: Which face here belongs in a modern art museum the most?"
      ];

      const topicText = topics[Math.floor(Math.random() * topics.length)];
      const targetAI = Math.random() < 0.5 ? "gossip" : "critic";

      const chatMsg = await addDocument("chat_messages", {
        text: topicText,
        sender: targetAI === "critic" ? "Critic" : "Gossip",
        avatar: targetAI === "critic" ? AVATAR_CRITIC : AVATAR_GOSSIP,
        author_type: "ai",
        ai_id: targetAI,
        badge: "AI",
        likes: 0,
        createdAt: new Date().toISOString()
      });

      lastIdleTopicTime = now;
      await recordAICall();

      res.status(200).json({ success: true, message: chatMsg });
      return;
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("API /api/ai/chat error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
