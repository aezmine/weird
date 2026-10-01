// Vercel Serverless API Route: /api/ai/queue
// Background queue manager for bulk uploads and asynchronous AI auto-comments.
// Safe rate-limited execution with max 2 retries per job.

const { getDocument, addDocument, updateDocument, queryCollection, listDocuments } = require("../lib/firestore-rest.js");
const { generateAIResponse, generateVisionDescription } = require("../lib/ai-clients.js");
const { getAIMemory, recordAIComment } = require("../lib/memory.js");
const { checkGlobalCapAndStatus, recordAICall } = require("../lib/rate-limiter.js");

const AVATAR_GOSSIP = "https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/ttanlankvxliwxh1potw.jpg";
const AVATAR_CRITIC = "https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/kioa9cgrappuxay0emgt.jpg";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const isPost = req.method === "POST";
    const body = isPost ? req.body || {} : req.query || {};
    const action = body.action || "process";

    // Enqueue jobs (e.g. from bulk upload)
    if (action === "enqueue") {
      const faceIds = Array.isArray(body.faceIds) ? body.faceIds : [body.faceId].filter(Boolean);
      if (faceIds.length === 0) {
        res.status(400).json({ error: "No faceIds provided" });
        return;
      }

      const enqueued = [];
      for (const faceId of faceIds) {
        const jobDoc = await addDocument("ai_jobs", {
          type: body.type || "auto_comment",
          faceId,
          status: "pending",
          attempts: 0,
          createdAt: new Date().toISOString()
        });
        enqueued.push(jobDoc.id);
      }

      // Automatically process the first batch right away
      processQueueBatch(3).catch(err => console.warn("Async queue batch error:", err));

      res.status(200).json({
        success: true,
        enqueuedCount: enqueued.length,
        jobs: enqueued
      });
      return;
    }

    // Process queue
    const capCheck = await checkGlobalCapAndStatus();
    if (!capCheck.allowed) {
      res.status(200).json({
        success: false,
        message: capCheck.reason,
        status: capCheck.status
      });
      return;
    }

    const processed = await processQueueBatch(3);

    res.status(200).json({
      success: true,
      processedCount: processed.length,
      processed
    });
  } catch (err) {
    console.error("Queue processor error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};

/**
 * Processes up to `limit` pending jobs sequentially
 */
async function processQueueBatch(limit = 3) {
  const allJobs = await listDocuments("ai_jobs", 30);
  const pendingJobs = allJobs
    .filter(j => j.status === "pending" && (j.attempts || 0) < 2)
    .slice(0, limit);

  const results = [];

  for (const job of pendingJobs) {
    const jobId = job.id;
    const faceId = job.faceId;

    try {
      // Mark processing and increment attempt count
      await updateDocument("ai_jobs", jobId, {
        status: "processing",
        attempts: (job.attempts || 0) + 1,
        processedAt: new Date().toISOString()
      });

      const face = await getDocument("faces", faceId);
      if (!face || face.ai_disabled) {
        await updateDocument("ai_jobs", jobId, {
          status: "completed",
          skipped: true,
          reason: "Face deleted or AI disabled"
        });
        results.push({ jobId, status: "skipped" });
        continue;
      }

      // 1. Vision description caching (run once)
      if (!face.ai_description && face.image) {
        const desc = await generateVisionDescription(face.image, face.name, face.expression);
        face.ai_description = desc;
        if (!face.ai_nickname) {
          face.ai_nickname = `Captain ${(face.expression || "Silly").split(" ")[0]}`;
        }
        await updateDocument("faces", faceId, {
          ai_description: desc,
          ai_nickname: face.ai_nickname
        });
      }

      // 2. Check if AI comments already exist
      const existingComments = await queryCollection("face_comments", {
        whereEqual: [["faceId", faceId]],
        limit: 10
      });

      const hasGossip = existingComments.some(c => c.author_type === "ai" && c.ai_id === "gossip");
      const hasCritic = existingComments.some(c => c.author_type === "ai" && c.ai_id === "critic");

      if (!hasGossip) {
        const gossipMem = await getAIMemory("gossip");
        const gRes = await generateAIResponse("gossip", { task: "comment", face, memory: gossipMem });
        await addDocument("face_comments", {
          faceId,
          faceName: face.name || "Funny Face",
          text: gRes.text,
          sender: "Gossip",
          avatar: AVATAR_GOSSIP,
          author_type: "ai",
          ai_id: "gossip",
          badge: "AI",
          likes: 0,
          reactions: {},
          createdAt: new Date().toISOString()
        });
        await recordAIComment("gossip", { text: gRes.text, opening: gRes.opening, faceId });
        await recordAICall();
      }

      // Small natural pause between AI comments
      await sleep(1800);

      if (!hasCritic) {
        const criticMem = await getAIMemory("critic");
        const cRes = await generateAIResponse("critic", { task: "comment", face, memory: criticMem });
        await addDocument("face_comments", {
          faceId,
          faceName: face.name || "Funny Face",
          text: cRes.text,
          sender: "Critic",
          avatar: AVATAR_CRITIC,
          author_type: "ai",
          ai_id: "critic",
          badge: "AI",
          likes: 0,
          reactions: {},
          createdAt: new Date().toISOString()
        });
        await recordAIComment("critic", { text: cRes.text, opening: cRes.opening, faceId });
        await recordAICall();
      }

      // Mark job completed
      await updateDocument("ai_jobs", jobId, {
        status: "completed",
        completedAt: new Date().toISOString()
      });

      results.push({ jobId, status: "completed", faceId });

      // Stagger next job by 2 seconds
      await sleep(2000);
    } catch (jobErr) {
      console.error(`Job ${jobId} failed:`, jobErr.message);
      const isFinalAttempt = (job.attempts || 0) + 1 >= 2;
      await updateDocument("ai_jobs", jobId, {
        status: isFinalAttempt ? "failed" : "pending",
        error: jobErr.message
      });
      results.push({ jobId, status: isFinalAttempt ? "failed" : "retry", error: jobErr.message });
    }
  }

  return results;
}
