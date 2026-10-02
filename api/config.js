// Vercel Serverless API Route: /api/config
// Serves environment-configured Firebase and Cloudinary properties to the frontend at runtime.
// Prevents hardcoding API keys, project IDs, and upload presets in GitHub repository files.

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=60");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || "";

  res.status(200).json({
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || "",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : ""),
      projectId: projectId,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.firebasestorage.app` : ""),
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.FIREBASE_APP_ID || ""
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || ""
    }
  });
};
