// Vercel Serverless API Route: /api/ai/comment
// Handles Auto-commenting on new faces, on-demand Ask Gossip / Ask Critic, Hype It, and Roast It.

const { getDocument, addDocument, updateDocument, queryCollection } = require("../lib/firestore-rest.js");
const { generateAIResponse, generateVisionDescription } = require("../lib/ai-clients.js");
const { getAIMemory, recordAIComment } = require("../lib/memory.js");
const { checkVisitorLimit, checkGlobalCapAndStatus, recordAICall } = require("../lib/rate-limiter.js");

const AVATAR_GOSSIP = "https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/ttanlankvxliwxh1potw.jpg";
const AVATAR_CRITIC = "https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/kioa9cgrappuxay0emgt.jpg";

module.exports = async function handler(req, res) {
  // Set CORS headers
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
      action = "auto", // "auto" | "ask_gossip" | "ask_critic" | "hype" | "roast"
      visitorId = "anon",
      visitorName = "Visitor"
    } = req.body || {};

    if (!faceId) {
      res.status(400).json({ error: "Missing faceId" });
      return;
    }

    // 1. Check Global Cap and Master Kill Switch
    const capCheck = await checkGlobalCapAndStatus();
    if (!capCheck.allowed) {
      res.status(200).json({
        success: false,
        cap_reached: capCheck.cap_reached || false,
        disabled: capCheck.status === "disabled",
        message: capCheck.reason || "The Crew is resting right now."
      });
      return;
    }

    // 2. Check Visitor Rate Limit for on-demand requests
    if (action !== "auto") {
      const visitorCheck = checkVisitorLimit(visitorId);
      if (!visitorCheck.allowed) {
        res.status(429).json({
          success: false,
          rate_limited: true,
          error: visitorCheck.reason
        });
        return;
      }
    }

    // 3. Fetch face document
    const face = await getDocument("faces", faceId);
    if (!face) {
      res.status(404).json({ error: "Face not found" });
      return;
    }

    // Per-face kill switch check
    if (face.ai_disabled) {
      res.status(403).json({ error: "AI interaction is disabled for this face" });
      return;
    }


    // 4. Ensure Vision Description is cached (Run once only)
    if (!face.ai_description && face.image) {
      console.log(`Generating initial vision description for face: ${face.name}...`);
      const desc = await generateVisionDescription(face.image, face.name, face.expression);
      face.ai_description = desc;
      
      // Also generate initial nickname if missing
      if (!face.ai_nickname) {
        const adjectives = ["Captain", "Professor", "Lord", "Master", "Agent", "Baron"];
        const moodWord = (face.expression || "Silly").split(" ")[0];
        face.ai_nickname = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${moodWord}`;
      }

      await updateDocument("faces", faceId, {
        ai_description: face.ai_description,
        ai_nickname: face.ai_nickname
      });
    }

    // 5. Query recent comments for context
    const existingComments = await queryCollection("face_comments", {
      whereEqual: [["faceId", faceId]],
      limit: 10
    });

    // 6. Handle action dispatch
    if (action === "auto") {
      // Check if AIs already commented on this face
      const alreadyHasGossip = existingComments.some(c => c.author_type === "ai" && c.ai_id === "gossip");
      const alreadyHasCritic = existingComments.some(c => c.author_type === "ai" && c.ai_id === "critic");

      if (alreadyHasGossip && alreadyHasCritic) {
        res.status(200).json({
          success: true,
          message: "AIs have already commented on this face.",
          skipped: true
        });
        return;
      }

      const results = [];

      // Gossip comment (if not already posted)
      if (!alreadyHasGossip) {
        const gossipMem = await getAIMemory("gossip");
        const gossipRes = await generateAIResponse("gossip", {
          task: "comment",
          face,
          recentComments: existingComments,
          memory: gossipMem
        });

        const gossipComment = await addDocument("face_comments", {
          faceId,
          faceName: face.name || "Funny Face",
          text: gossipRes.text,
          sender: "Gossip",
          avatar: AVATAR_GOSSIP,
          author_type: "ai",
          ai_id: "gossip",
          badge: "AI",
          likes: 0,
          reactions: {},
          createdAt: new Date().toISOString()
        });

        await recordAIComment("gossip", {
          text: gossipRes.text,
          opening: gossipRes.opening,
          faceId,
          nickname: face.ai_nickname,
          isLoved: true
        });
        await recordAICall();
        results.push(gossipComment);
      }

      // Critic comment (if not already posted)
      if (!alreadyHasCritic) {
        const criticMem = await getAIMemory("critic");
        const criticRes = await generateAIResponse("critic", {
          task: "comment",
          face,
          recentComments: [...existingComments, ...results],
          memory: criticMem
        });

        const criticComment = await addDocument("face_comments", {
          faceId,
          faceName: face.name || "Funny Face",
          text: criticRes.text,
          sender: "Critic",
          avatar: AVATAR_CRITIC,
          author_type: "ai",
          ai_id: "critic",
          badge: "AI",
          likes: 0,
          reactions: {},
          createdAt: new Date(Date.now() + 2500).toISOString() // Stagger by 2.5s for natural arrival
        });

        await recordAIComment("critic", {
          text: criticRes.text,
          opening: criticRes.opening,
          faceId,
          nickname: face.ai_nickname
        });
        await recordAICall();
        results.push(criticComment);
      }

      // Update face comment count
      const totalCount = (typeof face.commentsCount === "number" ? face.commentsCount : 0) + results.length;
      await updateDocument("faces", faceId, { commentsCount: totalCount });

      res.status(200).json({
        success: true,
        comments: results
      });
      return;
    }

    // On-demand actions: Ask Gossip, Ask Critic, Hype It, Roast It
    let targetAI = "gossip";
    let taskName = "comment";
    let senderName = "Gossip";
    let avatarUrl = AVATAR_GOSSIP;

    if (action === "ask_critic") {
      targetAI = "critic";
      senderName = "Critic";
      avatarUrl = AVATAR_CRITIC;
      taskName = "comment";
    } else if (action === "ask_gossip") {
      targetAI = "gossip";
      senderName = "Gossip";
      avatarUrl = AVATAR_GOSSIP;
      taskName = "comment";
    } else if (action === "hype") {
      targetAI = "gossip";
      senderName = "Gossip";
      avatarUrl = AVATAR_GOSSIP;
      taskName = "hype";
    } else if (action === "roast") {
      targetAI = "critic";
      senderName = "Critic";
      avatarUrl = AVATAR_CRITIC;
      taskName = "roast";
    }

    const aiMem = await getAIMemory(targetAI);
    const aiOutput = await generateAIResponse(targetAI, {
      task: taskName,
      face,
      recentComments: existingComments,
      memory: aiMem,
      visitorName
    });

    const newComment = await addDocument("face_comments", {
      faceId,
      faceName: face.name || "Funny Face",
      text: aiOutput.text,
      sender: senderName,
      avatar: avatarUrl,
      author_type: "ai",
      ai_id: targetAI,
      badge: "AI",
      action_type: action,
      likes: 0,
      reactions: {},
      createdAt: new Date().toISOString()
    });

    await recordAIComment(targetAI, {
      text: aiOutput.text,
      opening: aiOutput.opening,
      faceId,
      nickname: face.ai_nickname
    });
    await recordAICall();

    // Increment face commentsCount
    const currentCount = typeof face.commentsCount === "number" ? face.commentsCount : 0;
    await updateDocument("faces", faceId, { commentsCount: currentCount + 1 });

    res.status(200).json({
      success: true,
      comment: newComment
    });
  } catch (err) {
    console.error("API /api/ai/comment error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
