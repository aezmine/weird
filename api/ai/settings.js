// Vercel Serverless API Route: /api/ai/settings
// Admin control center for AI kill switch, daily cap, reply probability, comment moderation & analytics.

const { getDocument, setDocument, updateDocument, deleteDocument, listDocuments, queryCollection } = require("../lib/firestore-rest.js");

const ADMIN_CODE = "minmin321";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === "GET") {
      let settings = await getDocument("settings", "ai_settings");
      if (!settings) {
        settings = {
          ai_enabled: true,
          daily_cap: 150,
          calls_today: 0,
          reply_probability: 0.60,
          roast_default_allowed: true,
          cost_counter: 0
        };
      }

      // Fetch pending queue count
      const allJobs = await listDocuments("ai_jobs", 30);
      const pendingJobs = allJobs.filter(j => j.status === "pending" || j.status === "processing");

      // Fetch recent AI comments
      const allComments = await listDocuments("face_comments", 40);
      const aiComments = allComments
        .filter(c => c.author_type === "ai")
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 15);

      // Fetch reports
      const reports = await listDocuments("reports", 20);

      res.status(200).json({
        success: true,
        settings,
        queue: {
          pendingCount: pendingJobs.length,
          jobs: pendingJobs.slice(0, 5)
        },
        recentAIComments: aiComments,
        reports
      });
      return;
    }

    if (req.method === "POST") {
      const {
        adminCode,
        action = "update_settings",
        settings: newSettings,
        commentId,
        faceId,
        reportId,
        pinned
      } = req.body || {};

      if (adminCode !== ADMIN_CODE) {
        res.status(403).json({ error: "Invalid admin authorization code" });
        return;
      }

      if (action === "update_settings") {
        const current = (await getDocument("settings", "ai_settings")) || {};
        delete current.id;
        const updated = {
          ...current,
          ai_enabled: newSettings.ai_enabled !== undefined ? Boolean(newSettings.ai_enabled) : current.ai_enabled,
          daily_cap: (newSettings && newSettings.daily_cap !== undefined && !Number.isNaN(Number(newSettings.daily_cap))) ? Number(newSettings.daily_cap) : (current.daily_cap || 150),
          reply_probability: (newSettings && newSettings.reply_probability !== undefined && !Number.isNaN(Number(newSettings.reply_probability))) ? Number(newSettings.reply_probability) : (current.reply_probability !== undefined ? current.reply_probability : 0.60),
          roast_default_allowed: newSettings.roast_default_allowed !== undefined ? Boolean(newSettings.roast_default_allowed) : true
        };

        if (newSettings.reset_today) {
          updated.calls_today = 0;
          updated.cost_counter = 0;
        }

        await setDocument("settings", "ai_settings", updated);
        res.status(200).json({ success: true, settings: updated });
        return;
      }

      if (action === "delete_comment" && commentId) {
        const comment = await getDocument("face_comments", commentId);
        await deleteDocument("face_comments", commentId);
        if (comment && comment.faceId) {
          const face = await getDocument("faces", comment.faceId);
          if (face && typeof face.commentsCount === "number") {
            await updateDocument("faces", comment.faceId, {
              commentsCount: Math.max(0, face.commentsCount - 1)
            });
          }
        }
        res.status(200).json({ success: true, deletedCommentId: commentId });
        return;
      }

      if (action === "toggle_face_ai" && faceId) {
        const face = await getDocument("faces", faceId);
        if (!face) {
          res.status(404).json({ error: "Face not found" });
          return;
        }
        const newAiDisabled = !face.ai_disabled;
        await updateDocument("faces", faceId, { ai_disabled: newAiDisabled });
        res.status(200).json({ success: true, faceId, ai_disabled: newAiDisabled });
        return;
      }

      if (action === "pin_comment" && commentId) {
        await updateDocument("face_comments", commentId, { pinned: Boolean(pinned) });
        res.status(200).json({ success: true, commentId, pinned: Boolean(pinned) });
        return;
      }

      if (action === "resolve_report" && reportId) {
        await deleteDocument("reports", reportId);
        res.status(200).json({ success: true, resolvedReportId: reportId });
        return;
      }

      if (action === "hide_face" && faceId) {
        await updateDocument("faces", faceId, { hidden: true });
        res.status(200).json({ success: true, hiddenFaceId: faceId });
        return;
      }

      res.status(400).json({ error: "Unknown action" });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("API /api/ai/settings error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
