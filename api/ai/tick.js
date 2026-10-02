// Vercel Serverless API Route: /api/ai/tick
// Heartbeat scheduler endpoint that generates ~1 AI message per minute in Live Chat.
// Features distributed Firestore locking, token-optimized context, and provider fallback.

const { getDocument, setDocument, updateDocument, addDocument, listDocuments } = require("../lib/firestore-rest.js");
const { AI_CHARACTERS, selectNextCharacter, buildCharacterPrompt } = require("../lib/ai-characters.js");
const { generateGroupChatResponse } = require("../lib/ai-clients.js");
const { checkGlobalCapAndStatus, recordAICall } = require("../lib/rate-limiter.js");

const COOLDOWN_MS = 45000; // Minimum 45s between AI messages (~1 message per minute)
const LOCK_TIMEOUT_MS = 35000; // 35s lock timeout prevents deadlocks

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-cron-secret");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const isPost = req.method === "POST";
    const body = isPost ? (req.body || {}) : (req.query || {});
    const headers = req.headers || {};

    // 1. Authorization check
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = headers["authorization"] || "";
    const headerSecret = headers["x-cron-secret"] || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
    const querySecret = body.secret || req.query?.secret || "";
    const isSecretValid = Boolean(cronSecret && (headerSecret === cronSecret || querySecret === cronSecret));

    // If no secret provided, allow client heartbeat only if COOLDOWN has passed
    const isClientHeartbeat = body.source === "client" || body.source === "heartbeat" || !cronSecret;

    if (!isSecretValid && !isClientHeartbeat) {
      res.status(401).json({ error: "Unauthorized: Invalid or missing CRON_SECRET" });
      return;
    }

    // 2. Global AI Cap & Master switch check
    const capCheck = await checkGlobalCapAndStatus();
    if (!capCheck.allowed) {
      res.status(200).json({ skipped: true, reason: capCheck.reason, status: capCheck.status });
      return;
    }

    // 3. Read persistent AI state & evaluate lock
    let aiState = await getDocument("aiState", "main");
    const now = Date.now();

    if (!aiState) {
      aiState = {
        currentTopic: "Everyone is arguing about Ijat's camera and who is really in charge",
        mood: "chaotic",
        lastSpeaker: null,
        speakerHistory: [],
        messageCount: 0,
        runningJokes: [
          "Ijat claims his camera is from 2025, not 2009",
          "Azmin keeps pretending he has master administrative authority",
          "Pavin won't stop starting fights"
        ],
        generationInProgress: false,
        lockUntil: 0,
        lastGeneratedAt: null,
        updatedAt: new Date().toISOString()
      };
      await setDocument("aiState", "main", aiState);
    }

    // Check concurrency lock
    const isLocked = Boolean(aiState.generationInProgress && aiState.lockUntil && now < new Date(aiState.lockUntil).getTime());
    if (isLocked) {
      res.status(200).json({ skipped: true, reason: "Turn currently in progress by another worker" });
      return;
    }

    // Check cooldown (~1 message per minute target)
    if (!body.force && aiState.lastGeneratedAt) {
      const elapsed = now - new Date(aiState.lastGeneratedAt).getTime();
      if (elapsed < COOLDOWN_MS) {
        const remainingSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        res.status(200).json({
          skipped: true,
          reason: `Cooldown active: ${remainingSec}s remaining until next AI turn`
        });
        return;
      }
    }

    // 4. Acquire Lock
    await updateDocument("aiState", "main", {
      generationInProgress: true,
      lockUntil: new Date(now + LOCK_TIMEOUT_MS).toISOString()
    });

    try {
      // 5. Gather recent messages (last 8)
      const allMsgs = await listDocuments("chat_messages", 25);
      const sortedMsgs = (allMsgs || []).sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeA - timeB;
      });
      const recentMessages = sortedMsgs.slice(-8);

      // 6. Gather optional recent website event
      let websiteEvent = null;
      try {
        const faces = await listDocuments("faces", 5);
        if (faces && faces.length > 0) {
          const sortedFaces = faces.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          const latestFace = sortedFaces[0];
          const faceTime = latestFace?.createdAt ? new Date(latestFace.createdAt).getTime() : 0;
          // Mention latest face if added recently (last 30 mins) or occasionally (30% chance)
          if (now - faceTime < 30 * 60 * 1000 || Math.random() < 0.25) {
            websiteEvent = `A funny face titled "${latestFace.name || 'Anonymous'}" (${latestFace.expression || 'Weird'}) was uploaded recently!`;
          }
        }
      } catch (e) {
        // Non-critical, continue
      }

      // 7. Select next character intelligently
      const character = selectNextCharacter({
        speakerHistory: aiState.speakerHistory || [],
        recentMessages,
        forceCharacter: body.character || null
      });

      // 8. Build prompt
      const { systemPrompt, userPrompt } = buildCharacterPrompt({
        character,
        recentMessages,
        aiState,
        websiteEvent
      });

      // 9. Generate AI response (handles Groq / Gemini with automatic fallback)
      const genResult = await generateGroupChatResponse({
        character,
        systemPrompt,
        userPrompt,
        forcedProvider: body.provider || null
      });

      if (!genResult.success || !genResult.text) {
        throw new Error(genResult.error || "Failed to generate AI response from all providers");
      }

      // 10. Save AI message to Firestore Live Chat
      const createdIso = new Date().toISOString();
      const chatDoc = await addDocument("chat_messages", {
        characterId: character.id,
        characterName: character.name,
        sender: character.name,
        avatar: character.avatar,
        message: genResult.text,
        text: genResult.text,
        provider: genResult.provider,
        type: "ai",
        author_type: "ai",
        badge: "AI",
        likes: 0,
        createdAt: createdIso
      });

      // 11. Update AI state & release lock
      const updatedHistory = [...(aiState.speakerHistory || []).slice(-4), character.id];
      const newCount = (typeof aiState.messageCount === "number" ? aiState.messageCount : 0) + 1;

      // Occasionally evolve the topic slightly after every 10 messages
      let newTopic = aiState.currentTopic;
      if (newCount % 10 === 0) {
        const TOPIC_PRESETS = [
          "Everyone is debating whose face would win in an intergalactic meme contest",
          "Ijat claims he is starting a rival meme website with 2009 technology",
          "Azmin issued a fake emergency decree banning bad puns, which nobody obeyed",
          "Bella leaked that someone has an unposted draft with 10/10 rating",
          "Pavin challenged the entire chat room to an unsanctioned staring contest"
        ];
        newTopic = TOPIC_PRESETS[Math.floor(Math.random() * TOPIC_PRESETS.length)];
      }

      await updateDocument("aiState", "main", {
        lastSpeaker: character.id,
        speakerHistory: updatedHistory,
        messageCount: newCount,
        currentTopic: newTopic,
        generationInProgress: false,
        lockUntil: 0,
        lastGeneratedAt: createdIso,
        updatedAt: createdIso
      });

      // Record call for rate limiter & analytics
      await recordAICall();

      res.status(200).json({
        success: true,
        message: chatDoc,
        character: character.name,
        provider: genResult.provider,
        text: genResult.text
      });
    } catch (turnErr) {
      // Release lock on error so subsequent turns are not stuck
      await updateDocument("aiState", "main", {
        generationInProgress: false,
        lockUntil: 0,
        updatedAt: new Date().toISOString()
      }).catch(() => {});

      console.error("[AI Tick] Turn failed:", turnErr.message);
      res.status(500).json({
        success: false,
        error: turnErr.message
      });
    }
  } catch (err) {
    console.error("[AI Tick] Handler error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
