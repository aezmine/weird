// Dual-AI Model Clients & Persona Prompt Engine
// Gossip (Hype Friend) + Critic (Deadpan Judge)
// Enforces safety rules, vision caching, and high-performance token usage.

const { checkModeration } = require("./moderation.js");

function getEnvKeys() {
  return {
    gossipKey: process.env.AI_KEY_GOSSIP || process.env.GEMINI_API_KEY || process.env.STORY_KEY,
    criticKey: process.env.AI_KEY_CRITIC || process.env.GROQ_API_KEY || process.env.CHOICE_KEY,
    geminiKey: process.env.GEMINI_API_KEY || process.env.AI_KEY_GOSSIP || process.env.STORY_KEY,
    groqKey: process.env.GROQ_API_KEY || process.env.AI_KEY_CRITIC || process.env.CHOICE_KEY
  };
}

/**
 * Transforms Cloudinary URL to low-cost resized vision thumbnail (width: 512, auto eco quality)
 */
function getCloudinaryVisionUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
  if (!rawUrl.includes("res.cloudinary.com") || rawUrl.includes("/c_limit,w_512")) {
    return rawUrl;
  }
  const uploadIdx = rawUrl.indexOf("/upload/");
  if (uploadIdx !== -1) {
    return (
      rawUrl.slice(0, uploadIdx + 8) +
      "c_limit,w_512,q_auto:eco/" +
      rawUrl.slice(uploadIdx + 8)
    );
  }
  return rawUrl;
}

/**
 * Fetches image and converts to base64 for Gemini vision
 */
async function fetchImageBase64(imageUrl) {
  if (!imageUrl) return null;
  try {
    const resizedUrl = getCloudinaryVisionUrl(imageUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(resizedUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return {
      base64: buffer.toString("base64"),
      mimeType: mimeType.split(";")[0]
    };
  } catch (err) {
    console.warn("Vision image fetch failed:", err.message);
    return null;
  }
}

/**
 * Call Google Gemini (Vision & Text)
 */
async function callGemini({ prompt, imageBase64, mimeType = "image/jpeg", temperature = 0.7, maxTokens = 120, apiKey }) {
  const key = apiKey || getEnvKeys().geminiKey;
  if (!key) throw new Error("Missing Gemini API Key");

  const model = "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const parts = [];
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType,
        data: imageBase64
      }
    });
  }
  parts.push({ text: prompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
    return text.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Groq Cloud API
 */
async function callGroq({ systemPrompt, userPrompt, temperature = 0.75, maxTokens = 110, apiKey }) {
  const key = apiKey || getEnvKeys().groqKey;
  if (!key) throw new Error("Missing Groq API Key");

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages,
        temperature,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

// System prompts for Gossip and Critic (Private friends edition)
const SYSTEM_PROMPTS = {
  gossip: `You are "Gossip", the resident AI hype friend on MinWTF, a private fun site for close friends.
You can roast freely, like close friends teasing each other: sarcastic, savage, dramatic and chaotic are all fine. Roasting faces, expressions, outfits, poses and captions is allowed. You can joke freely about the friends in the photos and invent wild nicknames.

Hard limits:
1. No sexual content.
2. No real hate (slurs or attacks on race, religion or similar), and no threats.
3. No sharing private info like phone numbers or addresses.

Comments: max 220 characters, any number of emojis. Short and punchy is the goal.`,

  critic: `You are "Critic", the resident deadpan AI judge on MinWTF, a private fun site for close friends.
You can roast freely, like close friends teasing each other: sarcastic, savage, dramatic and chaotic are all fine. Roasting faces, expressions, outfits, poses and captions is allowed. Give deadpan reviews, scores out of 10, funny comparisons to food and movie characters, and give the friends nicknames.

Hard limits:
1. No sexual content.
2. No real hate (slurs or attacks on race, religion or similar), and no threats.
3. No sharing private info like phone numbers or addresses.

Comments: max 220 characters, any number of emojis. Short and punchy is the goal.`
};

/**
 * Generate vision description (runs once per face to cache)
 */
async function generateVisionDescription(imageUrl, title, mood) {
  const { geminiKey } = getEnvKeys();
  if (!geminiKey) {
    return `A person displaying an expressive ${mood || "funny"} face named ${title || "Funny Face"}.`;
  }

  try {
    const imgData = await fetchImageBase64(imageUrl);
    if (!imgData) {
      return `A person making a funny, expressive ${mood || "dramatic"} face.`;
    }

    const prompt = `Describe this person's facial expression, pose, outfit, and comedic vibe in 1 to 2 concise sentences (max 40 words).`;

    const desc = await callGemini({
      prompt,
      imageBase64: imgData.base64,
      mimeType: imgData.mimeType,
      temperature: 0.5,
      maxTokens: 60,
      apiKey: geminiKey
    });

    return desc || `A person making an unforgettable ${mood} expression.`;
  } catch (err) {
    console.warn("Vision description error:", err.message);
    return `An unhinged, hilarious ${mood || "weird"} face.`;
  }
}

/**
 * High-level AI generation dispatcher with automatic fallback
 */
async function generateAIResponse(aiId, {
  task = "comment", // "comment" | "reply" | "hype" | "roast" | "chat" | "extras"
  face = {},
  userComment = null,
  recentComments = [],
  memory = {},
  visitorName = "Someone",
  customPrompt = null
}) {
  const env = getEnvKeys();
  const character = aiId.toLowerCase() === "critic" ? "critic" : "gossip";
  const systemPrompt = SYSTEM_PROMPTS[character];

  const faceTitle = face.name || "This Face";
  const faceMood = face.expression || "Weird";
  const faceCaption = face.caption || "";
  const faceNickname = face.ai_nickname || memory.nicknames?.[face.id] || "The Legend";
  const visualDesc = face.ai_description || `A friend making a ${faceMood} expression in a photo titled "${faceCaption}".`;

  // Build context-specific user prompt
  let promptText = "";
  if (customPrompt) {
    promptText = customPrompt;
  } else if (task === "comment") {
    promptText = `React to this friend's photo:
Name: "${faceTitle}" (Nickname: "${faceNickname}")
Mood: "${faceMood}"
Caption: "${faceCaption}"
Visual: ${visualDesc}
${recentComments.length ? `Previous comments:\n${recentComments.slice(-3).map(c => `- ${c.sender}: "${c.text}"`).join("\n")}` : ""}

React in your authentic ${character === "gossip" ? "savage hype & dramatic" : "deadpan roast & scoring"} style.`;
  } else if (task === "hype") {
    promptText = `Hype up this friend!
Name: "${faceTitle}" (Nickname: "${faceNickname}")
Caption: "${faceCaption}"
Visual: ${visualDesc}

Write an enthusiastic, dramatic hype comment celebrating their chaotic energy!`;
  } else if (task === "roast") {
    promptText = `Roast this friend freely like a close friend teasing them:
Name: "${faceTitle}"
Caption: "${faceCaption}"
Visual: ${visualDesc}

Roast their face, expression, outfit, pose, or caption. Be savage, sarcastic, and funny!`;
  } else if (task === "reply") {
    promptText = `Reply to ${visitorName}'s comment under "${faceTitle}":
${visitorName} wrote: "${userComment}"
Visual: ${visualDesc}

Roast or reply directly to what ${visitorName} said like friends banter.`;
  } else if (task === "chat") {
    promptText = `Live Chat Room banter:
Message from ${visitorName}: "${userComment}"
Latest Face: "${faceTitle}" (${faceMood})

Reply with a snappy, unhinged line in chat.`;
  }

  // Attempt generation with primary AI key, fallback to secondary
  let rawOutput = "";
  let attempts = 0;

  while (attempts < 2 && !rawOutput) {
    attempts++;
    try {
      if (character === "critic" && env.criticKey) {
        rawOutput = await callGroq({
          systemPrompt,
          userPrompt: promptText,
          apiKey: env.criticKey
        });
      } else if (env.gossipKey) {
        rawOutput = await callGemini({
          prompt: `${systemPrompt}\n\nUser Request: ${promptText}`,
          apiKey: env.gossipKey
        });
      } else if (env.groqKey) {
        rawOutput = await callGroq({
          systemPrompt,
          userPrompt: promptText,
          apiKey: env.groqKey
        });
      }
    } catch (err) {
      console.warn(`${character} generation attempt ${attempts} failed:`, err.message);
    }
  }

  // Save AI output directly, format/truncate to max 220 chars
  const modResult = checkModeration(rawOutput);

  if (!modResult.sanitized) {
    const fallbackText = getProceduralFallback(character, task, faceTitle, faceNickname, visitorName);
    return {
      text: fallbackText,
      opening: "",
      isFallback: true
    };
  }

  return {
    text: modResult.sanitized,
    opening: "",
    isFallback: false
  };
}

/**
 * Procedural fallback when models are offline
 */
function getProceduralFallback(character, task, title, nickname, visitor) {
  if (character === "critic") {
    const options = [
      `I give this situation an 8.4/10. It possesses the exact dramatic tension of dropping buttered toast.`,
      `7.9/10. It gives vintage silent movie energy with a dash of unprovoked panic.`,
      `A respectable 8.1/10. Reminds me of an espresso machine making concerning sounds on a Monday morning.`,
      `8.7/10. The commitment to this questionable decision deserves an award.`,
      `7.3/10. Very convincing portrayal of someone who just heard microwave popcorn stop popping.`
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else {
    const options = [
      `STOP EVERYTHING! ${title} just won the award for most dramatic human alive!`,
      `Obsessed with this energy. ${nickname || 'This legend'} looks like they just solved a mystery nobody asked about!`,
      `This is peak main character behavior and nobody can tell me otherwise!`,
      `Not the side-eye of the century! Absolutely framing this in the MinWTF Hall of Fame!`,
      `The sheer panic in these eyes has made my entire week!`
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
}

/**
 * Unified Group Chat AI Response Generator with Provider Abstraction & Fallback.
 * Generates responses for PavinBot, Divka, Ijat, Bella, Azmin.
 * Uses Groq or Gemini based on character config, with automatic bidirectional fallback.
 */
async function generateGroupChatResponse({
  character,
  systemPrompt,
  userPrompt,
  forcedProvider = null
}) {
  const env = getEnvKeys();
  const primaryProvider = forcedProvider || character.provider || "groq";
  const secondaryProvider = primaryProvider === "groq" ? "gemini" : "groq";

  const providersToTry = [primaryProvider, secondaryProvider];
  let rawOutput = "";
  let usedProvider = primaryProvider;
  let lastError = null;

  for (const provider of providersToTry) {
    try {
      if (provider === "groq") {
        if (!env.groqKey) {
          throw new Error("Missing GROQ_API_KEY");
        }
        rawOutput = await callGroq({
          systemPrompt,
          userPrompt,
          temperature: 0.82,
          maxTokens: 60,
          apiKey: env.groqKey
        });
      } else if (provider === "gemini") {
        if (!env.geminiKey) {
          throw new Error("Missing GEMINI_API_KEY");
        }
        rawOutput = await callGemini({
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          temperature: 0.82,
          maxTokens: 60,
          apiKey: env.geminiKey
        });
      }

      if (rawOutput && rawOutput.trim().length > 0) {
        usedProvider = provider;
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI Chat] ${character.name} (${provider}) failed: ${err.message}. Trying fallback...`);
    }
  }

  if (!rawOutput || !rawOutput.trim()) {
    console.error(`[AI Chat] All providers failed for ${character.name}:`, lastError ? lastError.message : "Empty output");
    return {
      success: false,
      error: lastError ? lastError.message : "Empty output from all AI providers"
    };
  }

  // Clean up formatting
  let cleanText = rawOutput.trim();
  if ((cleanText.startsWith('"') && cleanText.endsWith('"')) || (cleanText.startsWith("'") && cleanText.endsWith("'"))) {
    cleanText = cleanText.slice(1, -1).trim();
  }
  const namePrefixRegex = new RegExp(`^${character.name}\\s*:\\s*`, "i");
  cleanText = cleanText.replace(namePrefixRegex, "").trim();

  // Enforce word limit (max 25 words)
  const words = cleanText.split(/\s+/);
  if (words.length > 25) {
    cleanText = words.slice(0, 25).join(" ") + "...";
  }

  return {
    success: true,
    text: cleanText,
    provider: usedProvider,
    characterId: character.id,
    characterName: character.name
  };
}

module.exports = {
  generateAIResponse,
  generateGroupChatResponse,
  generateVisionDescription,
  callGemini,
  callGroq,
  fetchImageBase64,
  getCloudinaryVisionUrl,
  SYSTEM_PROMPTS
};

