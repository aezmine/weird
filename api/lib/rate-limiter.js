// Rate Limiter & Global Cap Management for MinWTF AI
const { getDocument, setDocument, updateDocument } = require("./firestore-rest.js");

/**
 * Visitor check: Per-visitor rate limits removed for private friends site.
 * Always allowed. Daily cap in checkGlobalCapAndStatus() controls cost.
 */
function checkVisitorLimit(visitorId) {
  return { allowed: true };
}

/**
 * Checks and increments the global daily API cap
 */
async function checkGlobalCapAndStatus() {
  const todayStr = new Date().toISOString().split("T")[0];
  let settings = await getDocument("settings", "ai_settings");

  if (!settings) {
    settings = {
      ai_enabled: true,
      daily_cap: 150,
      calls_today: 0,
      last_reset_date: todayStr,
      reply_probability: 0.60,
      roast_default_allowed: true,
      cost_counter: 0
    };
    await setDocument("settings", "ai_settings", settings);
  }

  // Check master kill switch
  if (settings.ai_enabled === false) {
    return {
      allowed: false,
      reason: "AI is currently disabled by Admin.",
      status: "disabled"
    };
  }

  // Daily reset check
  let callsToday = typeof settings.calls_today === "number" ? settings.calls_today : 0;
  if (settings.last_reset_date !== todayStr) {
    callsToday = 0;
    await updateDocument("settings", "ai_settings", {
      calls_today: 0,
      last_reset_date: todayStr
    });
  }

  const dailyCap = typeof settings.daily_cap === "number" ? settings.daily_cap : 150;
  if (callsToday >= dailyCap) {
    return {
      allowed: false,
      reason: "The Crew is resting for the day! Global daily cap reached.",
      status: "resting",
      cap_reached: true
    };
  }

  return {
    allowed: true,
    callsToday,
    dailyCap,
    settings
  };
}

/**
 * Increment daily calls and cost counter after successful AI invocation
 */
async function recordAICall(costEstimate = 0.00015) {
  try {
    const settings = await getDocument("settings", "ai_settings");
    if (settings) {
      const callsToday = (settings.calls_today || 0) + 1;
      const costCounter = (parseFloat(settings.cost_counter) || 0) + costEstimate;
      await updateDocument("settings", "ai_settings", {
        calls_today: callsToday,
        cost_counter: parseFloat(costCounter.toFixed(5))
      });
    }
  } catch (err) {
    console.warn("Failed to increment AI call counter:", err.message);
  }
}

module.exports = {
  checkVisitorLimit,
  checkGlobalCapAndStatus,
  recordAICall
};
