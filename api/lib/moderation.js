// Output Formatter & Truncator for MinWTF
// Private friends site: Save AI output directly, truncate to max 220 characters, any number of emojis allowed.

function checkModeration(text) {
  if (!text || typeof text !== "string") {
    return { valid: true, sanitized: "" };
  }

  let clean = text.trim();

  // Max 220 characters limit
  if (clean.length > 220) {
    clean = clean.slice(0, 217).trim() + "...";
  }

  return {
    valid: true,
    sanitized: clean,
    opening: ""
  };
}

module.exports = {
  checkModeration
};
