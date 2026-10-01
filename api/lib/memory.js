// AI Memory Management Service for Gossip and Critic
const { getDocument, setDocument } = require("./firestore-rest.js");

const DEFAULT_MEMORY = {
  gossip: {
    running_jokes: [
      "The 'Monday 8 AM' phantom alarm",
      "Donut theft detective agency",
      "Main character soundtrack playing in background"
    ],
    nicknames: {},
    loved_faces: [],
    hated_faces: [],
    summary: "Gossip loves chaotic energy, expressive eyebrows, and dramatic reactions. Believes every photo is the climax of an unwritten sitcom episode.",
    comments_count: 0,
    recent_openings: []
  },
  critic: {
    running_jokes: [
      "The cinematic ratio of confusion to confidence",
      "Stale croissant aesthetic",
      "Rating everyday panic 7.8 out of 10"
    ],
    nicknames: {},
    loved_faces: [],
    hated_faces: [],
    summary: "Critic meticulously analyzes facial geometry, comparing expressions to French cinema, kitchen appliances, and dramatic pauses in period dramas.",
    comments_count: 0,
    recent_openings: []
  }
};

/**
 * Get AI memory from Firestore (or initialize if not found)
 */
async function getAIMemory(aiId) {
  const docId = aiId.toLowerCase();
  try {
    const mem = await getDocument("ai_memory", docId);
    if (mem && mem.summary) {
      return {
        running_jokes: Array.isArray(mem.running_jokes) ? mem.running_jokes : [],
        nicknames: mem.nicknames || {},
        loved_faces: Array.isArray(mem.loved_faces) ? mem.loved_faces : [],
        hated_faces: Array.isArray(mem.hated_faces) ? mem.hated_faces : [],
        summary: mem.summary || DEFAULT_MEMORY[docId]?.summary || "",
        comments_count: typeof mem.comments_count === "number" ? mem.comments_count : 0,
        recent_openings: Array.isArray(mem.recent_openings) ? mem.recent_openings : []
      };
    }
  } catch (err) {
    console.warn(`Could not fetch memory for ${aiId}:`, err.message);
  }

  // Fallback to default memory and initialize
  const initial = DEFAULT_MEMORY[docId] || DEFAULT_MEMORY.gossip;
  try {
    await setDocument("ai_memory", docId, initial);
  } catch {}
  return initial;
}

/**
 * Record a comment made by the AI, updating count, openings, and rolling summary
 */
async function recordAIComment(aiId, { text, opening, faceId, nickname, isLoved, isHated }) {
  const docId = aiId.toLowerCase();
  const mem = await getAIMemory(docId);

  mem.comments_count = (mem.comments_count || 0) + 1;

  // Track last 10 openings
  if (opening) {
    mem.recent_openings = [opening, ...(mem.recent_openings || [])].slice(0, 10);
  }

  // Record nickname if face provided
  if (faceId && nickname) {
    if (!mem.nicknames) mem.nicknames = {};
    mem.nicknames[faceId] = nickname;
  }

  // Record loved / hated
  if (faceId) {
    if (isLoved && !mem.loved_faces.includes(faceId)) {
      mem.loved_faces = [faceId, ...mem.loved_faces].slice(0, 15);
    }
    if (isHated && !mem.hated_faces.includes(faceId)) {
      mem.hated_faces = [faceId, ...mem.hated_faces].slice(0, 15);
    }
  }

  // Every ~20 comments, prune and consolidate summary if needed
  if (mem.comments_count % 20 === 0) {
    // Keep summary under 150 words
    const words = (mem.summary || "").split(/\s+/);
    if (words.length > 140) {
      mem.summary = words.slice(0, 140).join(" ") + "...";
    }
  }

  try {
    await setDocument("ai_memory", docId, mem);
  } catch (err) {
    console.warn(`Failed to save AI memory for ${docId}:`, err.message);
  }

  return mem;
}

module.exports = {
  getAIMemory,
  recordAIComment,
  DEFAULT_MEMORY
};
