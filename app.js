// Main Application Logic - MinWTF Dual-AI Upgrade Edition
import { cloudinaryConfig } from "./firebase-config.js";
import { uploadToCloudinary, uploadMultipleToCloudinary, getOptimizedImageUrl, getFullImageUrl } from "./services/cloudinary.js";
import {
  subscribeToFaces,
  createFace,
  updateFace,
  deleteFace,
  bulkCreateFaces
} from "./services/faces-service.js";
import {
  getCurrentChatUser,
  saveCurrentChatUser,
  isFaceLiked,
  toggleFaceLike,
  isMessageLiked,
  toggleMessageLike,
  subscribeToLiveChat,
  sendChatMessage,
  subscribeToFaceComments,
  addFaceComment,
  playNotificationSound,
  FUNNY_AVATARS,
  STORAGE_KEY_SOUND,
  toggleCommentReaction,
  togglePinComment,
  getStoredNotifications,
  addNotification,
  clearStoredNotifications,
  triggerAiChatTick
} from "./services/chat-service.js";
import { icon, renderAvatarSvg, AVATAR_OPTIONS } from "./services/icons.js";
import { AI_CHARACTERS, getCharacterInfo } from "./services/ai-characters-config.js";

// Admin Auth State & Config
const ADMIN_ACCESS_CODE = "minmin321";
const AUTH_STORAGE_KEY = "funny_faces_admin_auth";
let isAdmin = false;
try {
  isAdmin = sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
} catch {}

// Global State
let allFaces = [];
let activeFaceForDetails = null;
let activeFaceForDelete = null;
let selectedImageFile = null;
let bulkSelectedFiles = [];
let currentFilter = "all";
let followedResidents = [];
try {
  followedResidents = JSON.parse(localStorage.getItem("minwtf_followed_ai") || "[]");
} catch {}
let activeChallenge = null;
let activeMood = null;
let inspectCommentFilter = "all";

// Live Chat & Comment State
let currentUser = getCurrentChatUser();
let selectedAvatarChoice = currentUser.avatar;
let activeFaceCommentsUnsubscribe = null;
let hasInitialChatLoaded = false;
let soundEnabled = true;
try {
  soundEnabled = localStorage.getItem(STORAGE_KEY_SOUND) !== "false";
} catch {}
let isChatPanelCollapsed = false;
let isMobileChatOpen = false;

// DOM Elements
const facesContainer = document.getElementById("faces-container");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const facesCounter = document.getElementById("faces-counter");
const searchInput = document.getElementById("search-input");
const configNotice = document.getElementById("config-notice");
const toastDock = document.getElementById("toastdock");

// Mood & Daily Challenge Elements
const todaysMoodBanner = document.getElementById("todays-mood-banner");
const todaysMoodText = document.getElementById("todays-mood-text");
const refreshMoodBtn = document.getElementById("refresh-mood-btn");
const dailyChallengeCard = document.getElementById("daily-challenge-card");
const challengeHostTag = document.getElementById("challenge-host-tag");
const viewChallengeBtn = document.getElementById("view-challenge-btn");
const challengeFacePreview = document.getElementById("challenge-face-preview");
const challengePromptText = document.getElementById("challenge-prompt-text");
const challengeVerdictBox = document.getElementById("challenge-verdict-box");

// Feed Filter Tabs
const filterPillBtns = document.querySelectorAll(".filter-pill-btn");

// Navigation & Popovers
const navHallOfFameBtn = document.getElementById("nav-hall-of-fame-btn");
const navAiCrewBtn = document.getElementById("nav-ai-crew-btn");
const notificationsBellBtn = document.getElementById("notifications-bell-btn");
const notificationsBadge = document.getElementById("notifications-badge");
const notificationsPopover = document.getElementById("notifications-popover");
const notificationsList = document.getElementById("notifications-list");
const clearNotificationsBtn = document.getElementById("clear-notifications-btn");

// Hall of Fame Dialog Elements
const hallOfFameDialog = document.getElementById("hall-of-fame-dialog");
const closeHofBtn = document.getElementById("close-hof-btn");
const dismissHofBtn = document.getElementById("dismiss-hof-btn");
const hofWeekTitle = document.getElementById("hof-week-title");
const hofWeekAnnouncement = document.getElementById("hof-week-announcement");
const hofWeekImg = document.getElementById("hof-week-img");
const hofWeekImgWrap = document.getElementById("hof-week-img-wrap");
const hofTopLikes = document.getElementById("hof-top-likes");
const hofTopRating = document.getElementById("hof-top-rating");
const hofTopCritic = document.getElementById("hof-top-critic");

// AI Crew Dialog Elements
const aiCrewDialog = document.getElementById("ai-crew-dialog");
const closeCrewBtn = document.getElementById("close-crew-btn");
const dismissCrewBtn = document.getElementById("dismiss-crew-btn");
const followGossipBtn = document.getElementById("follow-gossip-btn");
const followCriticBtn = document.getElementById("follow-critic-btn");
const filterGossipFeedBtn = document.getElementById("filter-gossip-feed-btn");
const filterCriticFeedBtn = document.getElementById("filter-critic-feed-btn");
const gossipStatComments = document.getElementById("gossip-stat-comments");
const criticStatComments = document.getElementById("critic-stat-comments");

// Admin Dashboard Elements
const adminDashboardBtn = document.getElementById("admin-dashboard-btn");
const adminDashboardDialog = document.getElementById("admin-dashboard-dialog");
const closeAdminDashBtn = document.getElementById("close-admin-dash-btn");
const closeAdminDashFooterBtn = document.getElementById("close-admin-dash-footer-btn");
const adminAiMasterToggle = document.getElementById("admin-ai-master-toggle");
const adminRoastDefaultToggle = document.getElementById("admin-roast-default-toggle");
const adminDailyCapSlider = document.getElementById("admin-daily-cap-slider");
const adminCapDisplay = document.getElementById("admin-cap-display");
const adminReplyProbSlider = document.getElementById("admin-reply-prob-slider");
const adminProbDisplay = document.getElementById("admin-prob-display");
const saveAiSettingsBtn = document.getElementById("save-ai-settings-btn");
const adminCallsTodayCount = document.getElementById("admin-calls-today-count");
const adminCostCounter = document.getElementById("admin-cost-counter");
const adminResetCostBtn = document.getElementById("admin-reset-cost-btn");
const adminPendingQueueCount = document.getElementById("admin-pending-queue-count");
const adminRunQueueBtn = document.getElementById("admin-run-queue-btn");
const adminAiCommentsTbody = document.getElementById("admin-ai-comments-tbody");

// Layout & Live Chat Elements
const appSplitContainer = document.querySelector(".app-split-container");
const liveChatPanel = document.getElementById("live-chat-panel");
const toggleChatHeaderBtn = document.getElementById("toggle-chat-header-btn");
const headerChatBadge = document.getElementById("header-chat-badge");
const chatCountPill = document.getElementById("chat-count-pill");
const chatSoundBtn = document.getElementById("chat-sound-btn");
const chatSoundIcon = document.getElementById("chat-sound-icon");
const chatCollapseBtn = document.getElementById("chat-collapse-btn");
const chatCloseMobileBtn = document.getElementById("chat-close-mobile-btn");
const chatUserPill = document.getElementById("chat-user-pill");
const chatUserAvatar = document.getElementById("chat-user-avatar");
const chatUserName = document.getElementById("chat-user-name");
const chatMessagesContainer = document.getElementById("chat-messages-container");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const quickEmojiBtns = document.querySelectorAll(".quick-emoji-btn");
const mobileChatFab = document.getElementById("mobile-chat-fab");
const mobileChatBadge = document.getElementById("mobile-chat-badge");
const chatBackdrop = document.getElementById("chat-backdrop");

// Nickname Dialog Elements
const nicknameDialog = document.getElementById("nickname-dialog");
const closeNicknameDialogBtn = document.getElementById("close-nickname-dialog-btn");
const cancelNicknameBtn = document.getElementById("cancel-nickname-btn");
const nicknameForm = document.getElementById("nickname-form");
const nicknameInput = document.getElementById("nickname-input");
const randomizeNicknameBtn = document.getElementById("randomize-nickname-btn");
const avatarPickerGrid = document.getElementById("avatar-picker-grid");

// Detail Dialog Like Elements
const detailLikeBtn = document.getElementById("detail-like-btn");
const detailLikeText = document.getElementById("detail-like-text");
const detailLikeCount = document.getElementById("detail-like-count");

// Action Buttons
const addFaceBtn = document.getElementById("add-face-btn");
const emptyAddBtn = document.getElementById("empty-add-btn");
const bulkUploadBtn = document.getElementById("bulk-upload-btn");
const emptyBulkBtn = document.getElementById("empty-bulk-btn");

// Admin Auth Elements
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminStatusPill = document.getElementById("admin-status-pill");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const adminLoginDialog = document.getElementById("admin-login-dialog");
const closeAdminDialogBtn = document.getElementById("close-admin-dialog-btn");
const cancelAdminDialogBtn = document.getElementById("cancel-admin-dialog-btn");
const adminLoginForm = document.getElementById("admin-login-form");
const adminCodeInput = document.getElementById("admin-code-input");
const adminLoginError = document.getElementById("admin-login-error");

// Bulk Upload Dialog Elements
const bulkUploadDialog = document.getElementById("bulk-upload-dialog");
const closeBulkDialogBtn = document.getElementById("close-bulk-dialog-btn");
const cancelBulkBtn = document.getElementById("cancel-bulk-btn");
const bulkFileInput = document.getElementById("bulk-file-input");
const bulkUploadDropzone = document.getElementById("bulk-upload-dropzone");
const bulkFilesSummary = document.getElementById("bulk-files-summary");
const bulkThumbnailsContainer = document.getElementById("bulk-thumbnails-container");
const bulkDefaultExpression = document.getElementById("bulk-default-expression");
const bulkDefaultCaption = document.getElementById("bulk-default-caption");
const bulkProgressArea = document.getElementById("bulk-progress-area");
const bulkProgressLabel = document.getElementById("bulk-progress-label");
const bulkProgressPercent = document.getElementById("bulk-progress-percent");
const bulkProgressBar = document.getElementById("bulk-progress-bar");
const bulkProgressFilename = document.getElementById("bulk-progress-filename");
const bulkErrorMsg = document.getElementById("bulk-error-msg");
const startBulkUploadBtn = document.getElementById("start-bulk-upload-btn");
const bulkSpinner = document.getElementById("bulk-spinner");
const bulkBtnText = document.getElementById("bulk-btn-text");

// Detail Dialog
const detailsDialog = document.getElementById("details-dialog");
const detailTitle = document.getElementById("detail-title");
const dialogBody = document.getElementById("dialog-body");
const closeDialogBtn = document.getElementById("close-dialog-btn");
const detailCloseBtn = document.getElementById("detail-close-btn");
const detailEditBtn = document.getElementById("detail-edit-btn");
const detailDeleteBtn = document.getElementById("detail-delete-btn");

// Form Dialog
const faceFormDialog = document.getElementById("face-form-dialog");
const formDialogTitle = document.getElementById("form-dialog-title");
const closeFormBtn = document.getElementById("close-form-btn");
const cancelFormBtn = document.getElementById("cancel-form-btn");
const faceForm = document.getElementById("face-form");
const formFaceId = document.getElementById("form-face-id");
const formExistingImage = document.getElementById("form-existing-image");
const faceNameInput = document.getElementById("face-name");
const faceExpressionInput = document.getElementById("face-expression");
const faceScoreInput = document.getElementById("face-score");
const scoreDisplay = document.getElementById("score-display");
const faceCaptionInput = document.getElementById("face-caption");
const faceBackstoryInput = document.getElementById("face-backstory");
const imageUrlInput = document.getElementById("image-url-input");
const formErrorMsg = document.getElementById("form-error-msg");
const submitFormBtn = document.getElementById("submit-form-btn");
const submitSpinner = document.getElementById("submit-spinner");
const submitBtnText = document.getElementById("submit-btn-text");

// Upload Dropzone
const uploadDropzone = document.getElementById("upload-dropzone");
const imageFileInput = document.getElementById("image-file-input");
const dropzonePrompt = document.getElementById("dropzone-prompt");
const dropzonePreviewContainer = document.getElementById("dropzone-preview-container");
const imagePreview = document.getElementById("image-preview");
const imageFilename = document.getElementById("image-filename");
const changeImageBtn = document.getElementById("change-image-btn");

// Delete Dialog
const deleteConfirmDialog = document.getElementById("delete-confirm-dialog");
const deleteFaceName = document.getElementById("delete-face-name");
const closeDeleteDialogBtn = document.getElementById("close-delete-dialog-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const deleteSpinner = document.getElementById("delete-spinner");
const deleteBtnText = document.getElementById("delete-btn-text");

// Theme management (Single Grey Theme - Dark mode completely removed)
function initTheme() {
  document.documentElement.removeAttribute("data-theme");
  try {
    localStorage.removeItem("funny-faces-theme");
  } catch {}
}

// Check configuration
function checkConfiguration() {
  if (!cloudinaryConfig.cloudName || cloudinaryConfig.cloudName === "YOUR_CLOUD_NAME") {
    configNotice.querySelector(".notice-content").innerHTML = `
      <strong>Cloudinary Setup Needed:</strong> 
      Please set your Cloudinary <code>cloudName</code> inside <code>firebase-config.js</code>.
    `;
    configNotice.style.display = "block";
  } else if (!cloudinaryConfig.uploadPreset || cloudinaryConfig.uploadPreset === "YOUR_UPLOAD_PRESET") {
    configNotice.querySelector(".notice-content").innerHTML = `
      <strong>Cloudinary Upload Preset Needed:</strong> 
      Please set your unsigned <code>uploadPreset</code> in <code>firebase-config.js</code>.
    `;
    configNotice.style.display = "block";
  } else {
    configNotice.style.display = "none";
  }
}

// Restrained Toast Notification Helper
function showToast(message, type = "info") {
  const toastEl = document.createElement("div");
  toastEl.className = "toast";

  const iconSvg = type === "success"
    ? `<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round"><path d="M5 12l5 5 9-11"/></svg>`
    : type === "error"
    ? `<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    : `<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c5cfc" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  const title = type === "success" ? "Success" : type === "error" ? "Error" : "Notice";

  toastEl.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <strong>${title}</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;

  toastDock.appendChild(toastEl);
  setTimeout(() => {
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateY(6px)";
    toastEl.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    setTimeout(() => toastEl.remove(), 200);
  }, 3500);
}

// Safe HTML escaping
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Render Face Cards with Clean Modern Aesthetic & Thumbnail Optimization
function renderCards(facesToRender) {
  facesContainer.innerHTML = "";

  if (facesToRender.length === 0) {
    if (allFaces.length === 0) {
      emptyState.style.display = "block";
    } else {
      facesContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <p style="font-size: 14px; margin: 0;">No funny faces matched your search.</p>
        </div>
      `;
    }
    facesCounter.textContent = `${allFaces.length} face${allFaces.length === 1 ? "" : "s"}`;
    return;
  }

  emptyState.style.display = "none";
  const query = (searchInput.value || "").trim();
  if (query) {
    facesCounter.textContent = `${facesToRender.length} of ${allFaces.length} face${allFaces.length === 1 ? "" : "s"}`;
  } else {
    facesCounter.textContent = `${facesToRender.length} face${facesToRender.length === 1 ? "" : "s"}`;
  }

  facesToRender.forEach((face) => {
    const card = document.createElement("article");
    card.className = `face-card ${face.hidden ? 'face-card-hidden' : ''}`;

    // Deliver ultra-lightweight optimized thumbnail for cards (~20KB-40KB instead of multi-megabytes)
    const thumbUrl = getOptimizedImageUrl(face.image, { width: 440, height: 330, fit: "fill", quality: "auto:eco" });

    const isLiked = isFaceLiked(face.id);
    const likesCount = typeof face.likesCount === "number" ? face.likesCount : 0;
    const commentsCount = typeof face.commentsCount === "number" ? face.commentsCount : 0;

    const extras = face.ai_extras || null;
    const vibeLine = extras?.vibeLine || "";
    const autoTags = Array.isArray(extras?.autoTags) ? extras.autoTags : [];
    const criticScore = extras?.criticScore || "";
    const looksLike = extras?.looksLike || "";

    const socialControls = `
      <div class="card-social-actions">
        <button type="button" class="btn-card-like ${isLiked ? 'liked' : ''}" data-face-id="${escapeHtml(face.id)}" title="${isLiked ? 'Unlike' : 'Like'} this face" aria-label="Like ${escapeHtml(face.name)}">
          <span class="like-heart" aria-hidden="true">${isLiked ? icon('heartFilled', { size: 14 }) : icon('heartOutline', { size: 14 })}</span>
          <span class="like-num">${likesCount}</span>
        </button>
        <button type="button" class="btn-card-comment" data-face-id="${escapeHtml(face.id)}" title="View and write comments" aria-label="Comments for ${escapeHtml(face.name)}">
          <span aria-hidden="true">${icon('messageCircle', { size: 14 })}</span>
          <span class="comment-num">${commentsCount}</span>
        </button>
      </div>
    `;

    const actionButtons = isAdmin
      ? `
        <button type="button" class="btn btn--secondary btn--sm btn-detail">Inspect</button>
        ${socialControls}
        <button type="button" class="btn-icon btn-regen-ai" data-face-id="${escapeHtml(face.id)}" title="Regenerate AI Extras">${icon('refresh', { size: 13 })}</button>
        <button type="button" class="btn-icon btn-toggle-ai" data-face-id="${escapeHtml(face.id)}" title="${face.ai_disabled ? 'Enable AI' : 'Disable AI'}">${face.ai_disabled ? icon('botOff', { size: 13 }) : icon('bot', { size: 13 })}</button>
        <button type="button" class="btn-icon btn-edit" title="Edit face" aria-label="Edit ${escapeHtml(face.name)}">${icon('pencil', { size: 13 })}</button>
        <button type="button" class="btn-icon btn-delete" title="Delete face" aria-label="Delete ${escapeHtml(face.name)}">${icon('trash', { size: 13 })}</button>
      `
      : `
        <button type="button" class="btn btn--secondary btn--sm btn-detail">Inspect</button>
        ${socialControls}
      `;

    card.innerHTML = `
      <div class="card-img-wrapper" title="Click to view details">
        <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(face.name)}" loading="lazy" decoding="async" width="280" height="210">
        <div class="card-badges">
          <span class="badge badge-category" title="${escapeHtml(face.expression || 'Funny')}">${escapeHtml(face.expression || 'Funny')}</span>
          <span class="badge badge-score" title="User Rating">${icon('star', { size: 11 })} ${escapeHtml(face.funnyScore || '0')}</span>
          ${criticScore ? `<span class="badge badge-critic-score" title="Critic Score: ${escapeHtml(criticScore)}/10">${icon('bot', { size: 10 })} Critic ${escapeHtml(criticScore)}</span>` : ''}
        </div>
      </div>
      <div class="card-content">
        <h3 class="card-title" title="Click to view details">${escapeHtml(face.name)}</h3>
        ${vibeLine ? `<div class="card-vibe-line">“${escapeHtml(vibeLine)}”</div>` : ''}
        <p class="card-caption">${escapeHtml(face.caption ? `"${face.caption}"` : "")}</p>
        ${autoTags.length ? `<div class="card-tags-list">${autoTags.map(t => `<span class="card-tag-item">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${looksLike ? `<div class="card-looks-like" title="AI Comparison"><span>Looks like: ${escapeHtml(looksLike)}</span></div>` : ''}
        
        <div class="card-ai-buttons">
          <button type="button" class="btn-hype-card" data-face-id="${escapeHtml(face.id)}" title="Gossip writes an ultimate hype comment">
            <span>Hype It &rarr;</span>
          </button>
          <button type="button" class="btn-roast-card" data-face-id="${escapeHtml(face.id)}" title="Critic roasts this face">
            <span>Roast It &rarr;</span>
          </button>
        </div>

        <div class="card-actions" style="margin-top: 10px;">
          ${actionButtons}
        </div>
      </div>
    `;

    // Click on image or title or Inspect button -> Open Detail
    const openDetailTrigger = () => openDetails(face);
    card.querySelector(".card-img-wrapper").addEventListener("click", openDetailTrigger);
    card.querySelector(".card-title").addEventListener("click", openDetailTrigger);
    card.querySelector(".btn-detail").addEventListener("click", openDetailTrigger);

    // Hype it button click
    const hypeBtn = card.querySelector(".btn-hype-card");
    if (hypeBtn) {
      hypeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        hypeBtn.disabled = true;
        const originalText = hypeBtn.innerHTML;
        hypeBtn.innerHTML = `<span>Hyping...</span>`;
        try {
          const res = await fetch("/api/ai/comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              faceId: face.id,
              action: "hype",
              visitorId: currentUser.name,
              visitorName: currentUser.name
            })
          });
          const data = await res.json();
          if (data.cap_reached) {
            showToast("The Crew is resting for today!", "info");
          } else if (data.rate_limited) {
            showToast(data.error, "error");
          } else if (data.success) {
            showToast("Gossip just hyped this face in comments! 🔥", "success");
            openDetails(face, true);
          } else {
            showToast(data.error || "Could not generate hype comment.", "error");
          }
        } catch (err) {
          showToast("Network error generating hype.", "error");
        } finally {
          hypeBtn.disabled = false;
          hypeBtn.innerHTML = originalText;
        }
      });
    }

    // Roast it button click
    const roastBtn = card.querySelector(".btn-roast-card");
    if (roastBtn) {
      roastBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        roastBtn.disabled = true;
        const originalText = roastBtn.innerHTML;
        roastBtn.innerHTML = `<span>Roasting...</span>`;
        try {
          const res = await fetch("/api/ai/comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              faceId: face.id,
              action: "roast",
              visitorId: currentUser.name,
              visitorName: currentUser.name
            })
          });
          const data = await res.json();
          if (data.cap_reached) {
            showToast("The Crew is resting for today!", "info");
          } else if (data.rate_limited) {
            showToast(data.error, "error");
          } else if (data.success) {
            showToast("Critic delivered a light roast in comments! 🌶️", "success");
            openDetails(face, true);
          } else {
            showToast(data.error || "Could not generate roast comment.", "error");
          }
        } catch (err) {
          showToast("Network error generating roast.", "error");
        } finally {
          roastBtn.disabled = false;
          roastBtn.innerHTML = originalText;
        }
      });
    }

    // Like button click
    const cardLikeBtn = card.querySelector(".btn-card-like");
    if (cardLikeBtn) {
      cardLikeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          const newlyLiked = await toggleFaceLike(face.id);
          const numEl = cardLikeBtn.querySelector(".like-num");
          const heartEl = cardLikeBtn.querySelector(".like-heart");
          let current = parseInt(numEl.textContent, 10) || 0;
          if (newlyLiked) {
            cardLikeBtn.classList.add("liked");
            heartEl.innerHTML = icon('heartFilled', { size: 14 });
            heartEl.classList.add("like-anim");
            numEl.textContent = current + 1;
            face.likesCount = current + 1;
            showToast(`Liked "${face.name}"!`, "success");
          } else {
            cardLikeBtn.classList.remove("liked");
            heartEl.innerHTML = icon('heartOutline', { size: 14 });
            heartEl.classList.remove("like-anim");
            numEl.textContent = Math.max(0, current - 1);
            face.likesCount = Math.max(0, current - 1);
          }
        } catch (err) {
          console.error("Like toggle failed:", err);
          showToast("Unable to update like. Please try again.", "error");
        }
      });
    }

    // Comment button click -> Open Details directly to comments
    const cardCommentBtn = card.querySelector(".btn-card-comment");
    if (cardCommentBtn) {
      cardCommentBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetails(face, true);
      });
    }

    // Admin Regenerate AI button
    const regenBtn = card.querySelector(".btn-regen-ai");
    if (regenBtn) {
      regenBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        showToast(`Regenerating AI extras for "${face.name}"...`, "info");
        try {
          const res = await fetch("/api/ai/extras", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ faceId: face.id, forceRegenerate: true })
          });
          const data = await res.json();
          if (data.success) {
            face.ai_extras = data.extras;
            filterFaces();
            showToast("AI Extras refreshed!", "success");
          }
        } catch {
          showToast("Failed to regenerate extras", "error");
        }
      });
    }

    // Admin Toggle AI on face
    const toggleAiBtn = card.querySelector(".btn-toggle-ai");
    if (toggleAiBtn) {
      toggleAiBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch("/api/ai/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adminCode: ADMIN_ACCESS_CODE,
              action: "toggle_face_ai",
              faceId: face.id
            })
          });
          const data = await res.json();
          if (data.success) {
            face.ai_disabled = data.ai_disabled;
            filterFaces();
            showToast(data.ai_disabled ? "AI disabled for this face." : "AI enabled for this face.", "info");
          }
        } catch {
          showToast("Error updating AI status", "error");
        }
      });
    }

    // Edit button click (Admin only)
    const editBtn = card.querySelector(".btn-edit");
    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isAdmin) {
          showToast("Admin authentication required to edit faces.", "error");
          return;
        }
        openFormModal("edit", face);
      });
    }

    // Delete button click (Admin only)
    const deleteBtn = card.querySelector(".btn-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isAdmin) {
          showToast("Admin authentication required to delete faces.", "error");
          return;
        }
        promptDelete(face);
      });
    }

    facesContainer.appendChild(card);
  });
}

// Filter faces based on search & category filter tabs
function filterFaces() {
  let list = [...allFaces];

  // Filter hidden faces for non-admin
  if (!isAdmin) {
    list = list.filter(f => !f.hidden);
  }

  // Apply active tab filter
  if (currentFilter === "most-liked") {
    list.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
  } else if (currentFilter === "highest-rated") {
    list.sort((a, b) => parseFloat(b.funnyScore || 0) - parseFloat(a.funnyScore || 0));
  } else if (currentFilter === "critic-picks") {
    list.sort((a, b) => parseFloat(b.ai_extras?.criticScore || 0) - parseFloat(a.ai_extras?.criticScore || 0));
  } else if (currentFilter === "by-gossip") {
    list = list.filter(f => (f.ai_extras && f.ai_extras.vibeLine) || f.has_gossip_comment);
  } else if (currentFilter === "by-critic") {
    list = list.filter(f => (f.ai_extras && f.ai_extras.criticScore) || f.has_critic_comment);
  }

  const query = (searchInput.value || "").toLowerCase().trim();
  if (!query) {
    renderCards(list);
    return;
  }

  const filtered = list.filter((face) => {
    const nameMatch = (face.name || "").toLowerCase().includes(query);
    const exprMatch = (face.expression || "").toLowerCase().includes(query);
    const capMatch = (face.caption || "").toLowerCase().includes(query);
    const storyMatch = (face.backstory || "").toLowerCase().includes(query);
    const tagMatch = face.ai_extras?.autoTags?.some(t => t.toLowerCase().includes(query));
    const vibeMatch = (face.ai_extras?.vibeLine || "").toLowerCase().includes(query);
    return nameMatch || exprMatch || capMatch || storyMatch || tagMatch || vibeMatch;
  });

  renderCards(filtered);
}

// Format created date
function formatFaceDate(createdAt) {
  if (!createdAt) return "Recently added";
  try {
    const date = createdAt.toMillis ? new Date(createdAt.toMillis()) : new Date(createdAt);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
  } catch {
    return "Recently added";
  }
  return "Recently added";
}

// Relative time formatter for live comments and chat
function formatTimeAgo(timestamp) {
  if (!timestamp) return "just now";
  try {
    const millis = timestamp.toMillis ? timestamp.toMillis() : (typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime());
    if (isNaN(millis)) return "just now";
    const diffSec = Math.floor((Date.now() - millis) / 1000);
    if (diffSec < 10) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    const d = new Date(millis);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "just now";
  }
}

// Open Details Dialog
let activeFaceCommentsList = [];

function renderFaceCommentsList(face, container) {
  if (!container) return;

  let filtered = [...activeFaceCommentsList];
  if (inspectCommentFilter === "humans") {
    filtered = filtered.filter(c => c.author_type !== "ai");
  } else if (inspectCommentFilter === "gossip") {
    filtered = filtered.filter(c => c.author_type === "ai" && (c.ai_id === "gossip" || (c.sender || "").toLowerCase().includes("gossip")));
  } else if (inspectCommentFilter === "critic") {
    filtered = filtered.filter(c => c.author_type === "ai" && (c.ai_id === "critic" || (c.sender || "").toLowerCase().includes("critic")));
  }

  // Sort pinned comments first
  filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 8px; color: var(--text-muted); font-size: 12.5px;">
        <p style="margin: 0;">No comments in this view.</p>
        <span style="font-size: 11.5px; color: var(--text-subtle);">Be the first to say something or trigger an AI resident above!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((c) => {
    const isAi = c.author_type === "ai" || c.ai_id || c.sender === "Gossip" || c.sender === "Critic";
    const isCritic = c.ai_id === "critic" || c.sender === "Critic";
    const avatarUrl = isAi
      ? (isCritic
          ? getOptimizedImageUrl("https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/kioa9cgrappuxay0emgt.jpg", { width: 48, height: 48, fit: "fill", quality: "auto:eco" })
          : getOptimizedImageUrl("https://res.cloudinary.com/xwb8t4vr/image/upload/v1790848443/ttanlankvxliwxh1potw.jpg", { width: 48, height: 48, fit: "fill", quality: "auto:eco" }))
      : null;

    const avatarHtml = isAi
      ? `<img src="${avatarUrl}" class="face-comment-avatar-img" alt="${escapeHtml(c.sender)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--accent);">`
      : renderAvatarSvg(c.avatar, 20);

    const senderDisplay = isAi
      ? `<span class="face-comment-author ai-author" style="color: ${isCritic ? '#818cf8' : '#f472b6'}; font-weight: 700;">${escapeHtml(c.sender)} <span class="ai-badge">AI</span></span>`
      : `<span class="face-comment-author">${escapeHtml(c.sender || "Anonymous")}</span>`;

    const pinnedBadge = c.pinned ? `<span class="pinned-badge">Pinned</span>` : "";

    const reactions = c.reactions || {};
    const emojis = ["❤️", "🔥", "😂", "💀"];
    const reactionButtons = emojis.map((emoji) => {
      const count = reactions[emoji] || 0;
      const storageKey = `minwtf_reacted_${c.id}_${emoji}`;
      const reacted = localStorage.getItem(storageKey) === "true";
      return `
        <button type="button" class="comment-reaction-btn ${reacted ? 'reacted' : ''}" data-comment-id="${escapeHtml(c.id)}" data-emoji="${emoji}" title="React with ${emoji}">
          <span>${emoji}</span>
          ${count > 0 ? `<span class="reaction-count" style="font-size: 10.5px; margin-left: 2px;">${count}</span>` : ""}
        </button>
      `;
    }).join("");

    const adminActions = isAdmin
      ? `
        <button type="button" class="comment-pin-btn" data-comment-id="${escapeHtml(c.id)}" data-pinned="${Boolean(c.pinned)}" title="${c.pinned ? 'Unpin comment' : 'Pin comment'}">
          ${c.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button type="button" class="comment-delete-ai-btn" data-face-id="${escapeHtml(face.id)}" data-comment-id="${escapeHtml(c.id)}" title="Delete comment">
          Delete
        </button>
      `
      : "";

    return `
      <div class="face-comment-item ${isAi ? 'is-ai-comment' : ''} ${isCritic ? 'is-ai-critic' : ''} ${c.pinned ? 'is-pinned' : ''}" data-comment-id="${escapeHtml(c.id)}">
        <span class="face-comment-avatar" aria-hidden="true">${avatarHtml}</span>
        <div class="face-comment-content" style="flex: 1; min-width: 0;">
          <div class="face-comment-author-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              ${senderDisplay}
              ${pinnedBadge}
            </div>
            <span class="face-comment-time" style="font-size: 10.5px; color: var(--text-muted);">${formatTimeAgo(c.createdAt)}</span>
          </div>
          <div class="face-comment-text" style="font-size: 13px; line-height: 1.45; word-break: break-word;">${formatRichText(c.text)}</div>
          
          <div class="comment-actions-bar">
            <div class="reaction-btn-group">
              ${reactionButtons}
            </div>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 4px;">
              ${adminActions}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function openDetails(face, shouldFocusComments = false) {
  activeFaceForDetails = face;
  detailTitle.textContent = face.name;

  if (activeFaceCommentsUnsubscribe) {
    activeFaceCommentsUnsubscribe();
    activeFaceCommentsUnsubscribe = null;
  }

  const fullImageUrl = getFullImageUrl(face.image);
  const dateString = formatFaceDate(face.createdAt);
  const extras = face.ai_extras || {};
  const vibeLine = extras.vibeLine || "";
  const autoTags = Array.isArray(extras.autoTags) ? extras.autoTags : [];
  const criticScore = extras.criticScore || "";
  const criticReason = extras.criticReason || "";
  const looksLike = extras.looksLike || "";

  dialogBody.innerHTML = `
    <div class="inspect-container">
      <div class="inspect-img-stage" id="inspect-img-stage">
        <div class="inspect-loading" id="inspect-loading" style="display: none;">
          <span class="spinner"></span>
          <span style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">Loading full image...</span>
        </div>
        <img
          id="inspect-full-img"
          class="inspect-full-img"
          alt="${escapeHtml(face.name)}"
          title="Click to view full image in a new tab"
        >
        <div id="inspect-full-status" class="inspect-full-status">
          <span class="inspect-status-dot"></span>
          <span id="inspect-status-text">Loading full size...</span>
        </div>
        <a
          id="inspect-open-full-btn"
          href="${escapeHtml(fullImageUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="inspect-open-full-btn"
          title="Open original image in new tab"
          style="display: none;"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          <span>Full Image</span>
        </a>
        <div class="inspect-img-error" id="inspect-error" style="display: none;">
          <span style="display: inline-flex;" aria-hidden="true">${icon('alertTriangle', { size: 24 })}</span>
          <p style="margin: 4px 0 10px; font-size: 13px; color: var(--text-muted);">Unable to load full image</p>
          <button type="button" class="btn btn--secondary btn--sm" id="inspect-retry-btn">Retry</button>
        </div>
      </div>
      <div class="inspect-meta">
        <div class="inspect-badges">
          <span class="badge badge-category">${escapeHtml(face.expression || "Funny")}</span>
          <span class="badge badge-score">${icon('star', { size: 11 })} ${escapeHtml(face.funnyScore || "0")} / 10</span>
          ${criticScore ? `<span class="badge" style="background: var(--paper2); font-weight: 700;">🎩 Critic: ${escapeHtml(criticScore)}/10</span>` : ""}
        </div>

        ${vibeLine ? `
          <div class="inspect-vibe-box" style="margin: 6px 0 8px; font-size: 13.5px; font-style: italic; color: var(--ink); font-weight: 600;">
            ✨ "${escapeHtml(vibeLine)}"
          </div>
        ` : ""}

        ${autoTags.length > 0 ? `
          <div class="inspect-tags-row" style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 8px;">
            ${autoTags.map(t => `<span class="badge" style="background: var(--surface-raised); border: 1px solid var(--border); font-size: 11px; color: var(--text-muted);">#${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ""}

        ${criticScore && criticReason ? `
          <div class="inspect-critic-box" style="background: var(--paper2); border-left: 3px solid var(--ink); padding: 8px 12px; border-radius: var(--wob2); margin-bottom: 8px; font-size: 12.5px;">
            <strong>Critic's Take:</strong>
            <span style="color: var(--soft); margin-left: 4px;">"${escapeHtml(criticReason)}"</span>
          </div>
        ` : ""}

        ${looksLike ? `
          <div class="inspect-looks-like" style="font-size: 15px; color: var(--soft); margin-bottom: 8px;">
            <span>Looks like:</span> <strong style="color: var(--ink);">${escapeHtml(looksLike)}</strong>
          </div>
        ` : ""}

        ${face.caption ? `<div class="inspect-quote">"${escapeHtml(face.caption)}"</div>` : ""}
        ${face.backstory ? `
          <div class="inspect-backstory-box">
            <span class="inspect-section-title">Backstory</span>
            <div class="inspect-backstory">${escapeHtml(face.backstory)}</div>
          </div>
        ` : ""}
        <div class="inspect-date-row">
          <span>Added on ${escapeHtml(dateString)}</span>
        </div>

        <!-- Real-time Face Comments Section (Firestore) -->
        <div class="face-comments-section" id="inspect-comments-section">
          <div class="face-comments-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
            <div>
              <h4 style="margin: 0; font-size: 15px;">Comments (<span id="face-comments-count">0</span>)</h4>
              <span class="face-comments-sub" style="font-size: 11.5px; color: var(--text-muted);">Dual-AI resident banter & live reactions</span>
            </div>

            <!-- Comment Filter Tabs -->
            <div class="comment-filter-tabs" style="display: flex; gap: 4px; background: var(--surface-raised); padding: 3px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
              <button type="button" class="comment-filter-btn ${inspectCommentFilter === 'all' ? 'active' : ''}" data-filter="all" style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-xs); border: none; background: transparent; cursor: pointer; color: var(--text);">All</button>
              <button type="button" class="comment-filter-btn ${inspectCommentFilter === 'humans' ? 'active' : ''}" data-filter="humans" style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-xs); border: none; background: transparent; cursor: pointer; color: var(--text);">Humans</button>
              <button type="button" class="comment-filter-btn ${inspectCommentFilter === 'gossip' ? 'active' : ''}" data-filter="gossip" style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-xs); border: none; background: transparent; cursor: pointer; color: var(--text);">Gossip</button>
              <button type="button" class="comment-filter-btn ${inspectCommentFilter === 'critic' ? 'active' : ''}" data-filter="critic" style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-xs); border: none; background: transparent; cursor: pointer; color: var(--text);">Critic</button>
            </div>
          </div>

          <!-- On-Demand AI Residents Action Bar -->
          <div class="inspect-ai-actions-bar">
            <button type="button" class="btn btn--secondary btn--sm btn-ask-gossip" id="btn-ask-gossip" title="Ask Gossip for a fresh hype comment">
              <span>Ask Gossip &rarr;</span>
            </button>
            <button type="button" class="btn btn--secondary btn--sm btn-ask-critic" id="btn-ask-critic" title="Ask Critic for a review">
              <span>Ask Critic &rarr;</span>
            </button>
            <button type="button" class="btn btn--secondary btn--sm btn-hype-detail" id="btn-hype-detail" title="Hype this face">
              <span>Hype It &rarr;</span>
            </button>
            <button type="button" class="btn btn--secondary btn--sm btn-roast-detail" id="btn-roast-detail" title="Deliver a savage roast">
              <span>Roast It &rarr;</span>
            </button>
          </div>

          <!-- Typing indicator -->
          <div id="inspect-typing-indicator" class="ai-typing-indicator">
            <span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>
            <span id="inspect-typing-text">Gossip is typing...</span>
          </div>

          <div id="face-comments-list" class="face-comments-list" style="max-height: 380px; overflow-y: auto;">
            <div class="chat-loading-placeholder">
              <span class="spinner"></span>
              <span>Loading comments...</span>
            </div>
          </div>

          <form id="face-comment-form" class="face-comment-form" style="margin-top: 10px;">
            <div class="comment-input-box">
              <input
                type="text"
                id="face-comment-input"
                class="input"
                placeholder="Say something funny about ${escapeHtml(face.name)}..."
                maxlength="280"
                required
                autocomplete="off"
              >
              <button type="submit" id="face-comment-submit" class="btn btn--primary btn--sm">Comment</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Like button in modal footer
  if (detailLikeBtn) {
    const isLiked = isFaceLiked(face.id);
    const count = typeof face.likesCount === "number" ? face.likesCount : 0;
    detailLikeCount.textContent = count;
    detailLikeBtn.classList.toggle("liked", isLiked);
    if (detailLikeText) detailLikeText.textContent = isLiked ? "Liked" : "Like";
    const heartIconEl = detailLikeBtn.querySelector(".heart-icon");
    if (heartIconEl) {
      heartIconEl.innerHTML = isLiked ? icon('heartFilled', { size: 14 }) : icon('heartOutline', { size: 14 });
    }

    detailLikeBtn.onclick = async () => {
      try {
        const newlyLiked = await toggleFaceLike(face.id);
        let curr = parseInt(detailLikeCount.textContent, 10) || 0;
        if (newlyLiked) {
          detailLikeBtn.classList.add("liked");
          if (detailLikeText) detailLikeText.textContent = "Liked";
          if (heartIconEl) heartIconEl.innerHTML = icon('heartFilled', { size: 14 });
          detailLikeCount.textContent = curr + 1;
          face.likesCount = curr + 1;
          showToast(`Liked "${face.name}"!`, "success");
        } else {
          detailLikeBtn.classList.remove("liked");
          if (detailLikeText) detailLikeText.textContent = "Like";
          if (heartIconEl) heartIconEl.innerHTML = icon('heartOutline', { size: 14 });
          detailLikeCount.textContent = Math.max(0, curr - 1);
          face.likesCount = Math.max(0, curr - 1);
        }
        const cardLikeBtn = document.querySelector(`.btn-card-like[data-face-id="${face.id}"]`);
        if (cardLikeBtn) {
          cardLikeBtn.classList.toggle("liked", newlyLiked);
          cardLikeBtn.querySelector(".like-heart").innerHTML = newlyLiked ? icon('heartFilled', { size: 14 }) : icon('heartOutline', { size: 14 });
          cardLikeBtn.querySelector(".like-num").textContent = face.likesCount;
        }
      } catch (err) {
        console.error("Modal like toggle failed:", err);
        showToast("Unable to update like.", "error");
      }
    };
  }

  const commentsListEl = dialogBody.querySelector("#face-comments-list");
  const commentsCountEl = dialogBody.querySelector("#face-comments-count");
  const commentFormEl = dialogBody.querySelector("#face-comment-form");
  const commentInputEl = dialogBody.querySelector("#face-comment-input");
  const typingIndicator = dialogBody.querySelector("#inspect-typing-indicator");
  const typingText = dialogBody.querySelector("#inspect-typing-text");

  function showAiTyping(residentName) {
    if (typingIndicator && typingText) {
      typingText.textContent = `${residentName} is typing...`;
      typingIndicator.style.display = "inline-flex";
    }
  }

  function hideAiTyping() {
    if (typingIndicator) {
      typingIndicator.style.display = "none";
    }
  }

  // Comment filter tabs inside dialog
  const filterBtns = dialogBody.querySelectorAll(".comment-filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => {
        b.classList.remove("active");
        b.style.background = "transparent";
      });
      btn.classList.add("active");
      btn.style.background = "var(--surface-active)";
      inspectCommentFilter = btn.dataset.filter || "all";
      renderFaceCommentsList(face, commentsListEl);
    });
  });

  // Real-time comments listener for this face
  activeFaceCommentsUnsubscribe = subscribeToFaceComments(
    face.id,
    (comments) => {
      activeFaceCommentsList = comments;
      commentsCountEl.textContent = comments.length;
      face.commentsCount = comments.length;

      const cardCommentBtn = document.querySelector(`.btn-card-comment[data-face-id="${face.id}"]`);
      if (cardCommentBtn) {
        const numEl = cardCommentBtn.querySelector(".comment-num");
        if (numEl) numEl.textContent = comments.length;
      }

      renderFaceCommentsList(face, commentsListEl);
    },
    (err) => {
      commentsListEl.innerHTML = `<p style="color: var(--danger); font-size: 12px; margin: 0;">Failed to load comments: ${escapeHtml(err.message)}</p>`;
    }
  );

  // Delegated clicks for Reactions, Report, Pin, and Delete inside comments
  commentsListEl.addEventListener("click", async (e) => {
    // 1. Emoji reaction click
    const reactionBtn = e.target.closest(".comment-reaction-btn");
    if (reactionBtn) {
      const commentId = reactionBtn.dataset.commentId;
      const emoji = reactionBtn.dataset.emoji;
      if (commentId && emoji) {
        try {
          await toggleCommentReaction(commentId, emoji);
          reactionBtn.classList.toggle("reacted");
        } catch (err) {
          console.error("Reaction failed:", err);
        }
      }
      return;
    }

    // 3. Pin comment click (Admin only)
    const pinBtn = e.target.closest(".comment-pin-btn");
    if (pinBtn && isAdmin) {
      const commentId = pinBtn.dataset.commentId;
      const isPinned = pinBtn.dataset.pinned === "true";
      try {
        await togglePinComment(commentId, !isPinned);
        showToast(!isPinned ? "Comment pinned to top!" : "Comment unpinned.", "info");
      } catch (err) {
        showToast("Failed to pin comment", "error");
      }
      return;
    }

    // 4. Delete comment click (Admin only)
    const deleteCommentBtn = e.target.closest(".comment-delete-ai-btn");
    if (deleteCommentBtn && isAdmin) {
      const commentId = deleteCommentBtn.dataset.commentId;
      if (confirm("Delete this comment permanently?")) {
        try {
          const res = await fetch("/api/ai/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adminCode: ADMIN_ACCESS_CODE,
              action: "delete_comment",
              commentId
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast("Comment deleted", "info");
          } else {
            showToast(data.error || "Could not delete comment", "error");
          }
        } catch {
          showToast("Failed to delete comment", "error");
        }
      }
      return;
    }
  });

  // Wire AI action buttons inside inspect modal
  const askGossipBtn = dialogBody.querySelector("#btn-ask-gossip");
  const askCriticBtn = dialogBody.querySelector("#btn-ask-critic");
  const hypeBtn = dialogBody.querySelector("#btn-hype-detail");
  const roastBtn = dialogBody.querySelector("#btn-roast-detail");

  async function triggerAiComment(action, residentName) {
    showAiTyping(residentName);
    try {
      const res = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceId: face.id,
          action,
          visitorId: currentUser.name,
          visitorName: currentUser.name
        })
      });
      const data = await res.json();
      if (data.cap_reached) {
        showToast("The AI Crew is resting for today! Check back tomorrow.", "info");
      } else if (data.rate_limited) {
        showToast(data.error || "Rate limited. Please wait a few moments.", "error");
      } else if (data.success) {
        showToast(`${residentName} just left a comment!`, "success");
      } else {
        showToast(data.error || "Could not generate comment.", "error");
      }
    } catch (err) {
      showToast("Network error contacting AI resident.", "error");
    } finally {
      setTimeout(hideAiTyping, 1000);
    }
  }

  if (askGossipBtn) {
    askGossipBtn.addEventListener("click", () => triggerAiComment("ask_gossip", "Gossip"));
  }
  if (askCriticBtn) {
    askCriticBtn.addEventListener("click", () => triggerAiComment("ask_critic", "Critic"));
  }
  if (hypeBtn) {
    hypeBtn.addEventListener("click", () => triggerAiComment("hype", "Gossip"));
  }
  if (roastBtn) {
    roastBtn.addEventListener("click", () => triggerAiComment("roast", "Critic"));
  }

  // Comment Form Submit Handler
  commentFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (commentInputEl.value || "").trim();
    if (!text) return;

    const submitBtn = dialogBody.querySelector("#face-comment-submit");
    submitBtn.disabled = true;

    try {
      await addFaceComment(face.id, face.name, text);
      commentInputEl.value = "";
      showToast("Comment posted!", "success");
      // Hint to user that AI might reply
      setTimeout(() => {
        showAiTyping("The Crew");
        setTimeout(hideAiTyping, 3500);
      }, 500);
    } catch (err) {
      console.error("Posting comment failed:", err);
      showToast("Failed to post comment. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  const imgEl = dialogBody.querySelector("#inspect-full-img");
  const openFullBtn = dialogBody.querySelector("#inspect-open-full-btn");
  const loadingEl = dialogBody.querySelector("#inspect-loading");
  const errorEl = dialogBody.querySelector("#inspect-error");
  const retryBtn = dialogBody.querySelector("#inspect-retry-btn");
  const statusEl = dialogBody.querySelector("#inspect-full-status");
  const statusText = dialogBody.querySelector("#inspect-status-text");

  // Step 1: Immediately render the lightweight preview so the face shows instantly with 0 wait time
  const previewThumbUrl = getOptimizedImageUrl(face.image, { width: 560, height: 420, fit: "fill", quality: "auto:eco" });
  if (previewThumbUrl) {
    imgEl.src = previewThumbUrl;
    imgEl.style.display = "block";
  }

  // Step 2: Fetch and upgrade to the uncropped, real full-size original picture in the background
  function loadRealFullImage(url) {
    if (loadingEl) loadingEl.style.display = "none";
    if (errorEl) errorEl.style.display = "none";
    if (statusEl) {
      statusEl.style.display = "inline-flex";
      statusEl.classList.remove("is-ready");
      if (statusText) statusText.textContent = "Loading full size...";
    }

    const preloader = new Image();
    preloader.onload = () => {
      imgEl.src = url;
      imgEl.style.display = "block";
      if (openFullBtn && fullImageUrl) openFullBtn.style.display = "inline-flex";
      if (statusEl) {
        statusEl.classList.add("is-ready");
        if (statusText) statusText.textContent = "Full Size HD";
        setTimeout(() => {
          if (statusEl) statusEl.style.opacity = "0.75";
        }, 2200);
      }
    };

    preloader.onerror = () => {
      // If full image fails, keep preview image visible
      if (statusEl && statusText) {
        statusText.textContent = "Preview Mode";
      }
      if (!imgEl.src && errorEl) {
        errorEl.style.display = "flex";
      }
      if (openFullBtn && fullImageUrl) openFullBtn.style.display = "inline-flex";
    };

    preloader.src = url;
  }

  // Click on modal image opens full resolution in new tab
  imgEl.addEventListener("click", () => {
    if (fullImageUrl) {
      window.open(fullImageUrl, "_blank");
    }
  });

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      const retryUrl = fullImageUrl.includes("?")
        ? `${fullImageUrl}&_r=${Date.now()}`
        : `${fullImageUrl}?_r=${Date.now()}`;
      loadRealFullImage(retryUrl);
    });
  }

  loadRealFullImage(fullImageUrl);

  // Configure Inspect modal actions based on admin role
  if (detailEditBtn) detailEditBtn.style.display = isAdmin ? "inline-flex" : "none";
  if (detailDeleteBtn) detailDeleteBtn.style.display = isAdmin ? "inline-flex" : "none";

  detailsDialog.showModal();

  if (shouldFocusComments) {
    setTimeout(() => {
      const commentInput = dialogBody.querySelector("#face-comment-input");
      if (commentInput) {
        commentInput.focus();
        commentInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  }
}

function closeDetails() {
  if (activeFaceCommentsUnsubscribe) {
    activeFaceCommentsUnsubscribe();
    activeFaceCommentsUnsubscribe = null;
  }
  if (detailsDialog && detailsDialog.open) {
    detailsDialog.close();
  }
  activeFaceForDetails = null;
}

// Open Form Dialog (Create or Edit)
function openFormModal(mode, face = null) {
  if (mode === "edit" && !isAdmin) {
    showToast("Admin authentication required to edit faces.", "error");
    return;
  }

  formErrorMsg.style.display = "none";
  formErrorMsg.textContent = "";
  faceForm.reset();
  selectedImageFile = null;
  if (imageFilename) imageFilename.textContent = "";

  if (mode === "edit" && face) {
    formDialogTitle.textContent = "Edit Funny Face";
    formFaceId.value = face.id;
    formExistingImage.value = face.image || "";
    faceNameInput.value = face.name || "";
    faceExpressionInput.value = face.expression || "";
    faceScoreInput.value = face.funnyScore || "9.0";
    scoreDisplay.textContent = `${face.funnyScore || "9.0"} / 10`;
    faceCaptionInput.value = face.caption || "";
    faceBackstoryInput.value = face.backstory || "";
    imageUrlInput.value = "";

    // Show existing image in preview (optimized thumbnail)
    if (face.image) {
      imagePreview.src = getOptimizedImageUrl(face.image, { width: 360, height: 270, fit: "fill", quality: "auto:eco" });
      dropzonePrompt.style.display = "none";
      dropzonePreviewContainer.style.display = "flex";
      if (imageFilename) imageFilename.textContent = "Current image retained unless changed";
    }
    submitBtnText.textContent = "Update Face";
  } else {
    formDialogTitle.textContent = "Add Funny Face";
    formFaceId.value = "";
    formExistingImage.value = "";
    faceScoreInput.value = "9.0";
    scoreDisplay.textContent = "9.0 / 10";
    dropzonePrompt.style.display = "block";
    dropzonePreviewContainer.style.display = "none";
    imagePreview.src = "";
    if (imageFileInput) imageFileInput.value = "";
    imageUrlInput.value = "";
    submitBtnText.textContent = "Save Face";
  }

  faceFormDialog.showModal();
  const formBody = faceFormDialog.querySelector(".dialog-body");
  if (formBody) formBody.scrollTop = 0;
}

function closeFormModal() {
  if (faceFormDialog && faceFormDialog.open) {
    faceFormDialog.close();
  }
  faceForm.reset();
  if (imageFileInput) imageFileInput.value = "";
  selectedImageFile = null;
  if (imageFilename) imageFilename.textContent = "";
}

// Prompt Delete Modal
function promptDelete(face) {
  if (!isAdmin) {
    showToast("Admin authentication required to delete faces.", "error");
    return;
  }
  activeFaceForDelete = face;
  deleteFaceName.textContent = `"${face.name}"`;
  deleteConfirmDialog.showModal();
}

function closeDeleteModal() {
  if (deleteConfirmDialog && deleteConfirmDialog.open) {
    deleteConfirmDialog.close();
  }
  activeFaceForDelete = null;
}

// Setup Upload Dropzone
function setupUploadDropzone() {
  changeImageBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageFileInput.click();
  });

  imageFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.remove("dragover");
    });
  });

  uploadDropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });
}

function handleFileSelected(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Please choose an image file (PNG, JPG, WEBP, GIF)", "error");
    return;
  }

  selectedImageFile = file;
  const objectUrl = URL.createObjectURL(file);
  imagePreview.src = objectUrl;
  
  if (imageFilename) {
    imageFilename.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  }

  dropzonePrompt.style.display = "none";
  dropzonePreviewContainer.style.display = "flex";
  formErrorMsg.style.display = "none";
}

// Handle Form Submission (Create or Update)
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = formFaceId.value;
  const isEditing = Boolean(id);
  const name = faceNameInput.value.trim();
  const expression = faceExpressionInput.value.trim();
  const funnyScore = faceScoreInput.value;
  const caption = faceCaptionInput.value.trim();
  const backstory = faceBackstoryInput.value.trim();
  const directUrl = imageUrlInput.value.trim();
  const existingImage = formExistingImage.value;

  formErrorMsg.style.display = "none";
  let finalImageUrl = "";

  submitFormBtn.disabled = true;
  submitSpinner.style.display = "inline-block";

  try {
    if (selectedImageFile) {
      submitBtnText.textContent = "Uploading image...";
      finalImageUrl = await uploadToCloudinary(selectedImageFile);
    } else if (directUrl) {
      finalImageUrl = directUrl;
    } else if (isEditing && existingImage) {
      finalImageUrl = existingImage;
    } else {
      throw new Error("Please select an image file or provide an image link.");
    }

    submitBtnText.textContent = "Saving to database...";

    const facePayload = {
      name,
      expression,
      funnyScore,
      caption,
      backstory,
      image: finalImageUrl
    };

    if (isEditing) {
      await updateFace(id, facePayload);
      showToast(`Updated "${name}"`, "success");
    } else {
      await createFace(facePayload);
      showToast(`Added "${name}" to gallery`, "success");
    }

    closeFormModal();
  } catch (error) {
    console.error("Submission error:", error);
    formErrorMsg.textContent = error.message || "Failed to save face.";
    formErrorMsg.style.display = "block";
    formErrorMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast(error.message || "Save failed", "error");
  } finally {
    submitFormBtn.disabled = false;
    submitSpinner.style.display = "none";
    submitBtnText.textContent = isEditing ? "Update Face" : "Save Face";
  }
}

// Handle Delete Confirmation
async function handleDeleteConfirm() {
  if (!activeFaceForDelete) return;

  confirmDeleteBtn.disabled = true;
  deleteSpinner.style.display = "inline-block";
  deleteBtnText.textContent = "Deleting...";

  try {
    await deleteFace(activeFaceForDelete.id);
    showToast(`Deleted "${activeFaceForDelete.name}"`, "info");
    closeDeleteModal();
    if (activeFaceForDetails && activeFaceForDetails.id === activeFaceForDelete.id) {
      closeDetails();
    }
  } catch (error) {
    console.error("Delete failed:", error);
    showToast(`Failed to delete: ${error.message}`, "error");
  } finally {
    confirmDeleteBtn.disabled = false;
    deleteSpinner.style.display = "none";
    deleteBtnText.textContent = "Delete";
  }
}

// Bulk Upload Operations
function openBulkModal() {
  bulkSelectedFiles = [];
  bulkErrorMsg.style.display = "none";
  bulkErrorMsg.textContent = "";
  if (bulkFileInput) bulkFileInput.value = "";
  bulkFilesSummary.style.display = "none";
  bulkThumbnailsContainer.style.display = "none";
  bulkThumbnailsContainer.innerHTML = "";
  bulkProgressArea.style.display = "none";
  bulkProgressBar.style.width = "0%";
  bulkProgressPercent.textContent = "0%";
  startBulkUploadBtn.disabled = true;
  bulkBtnText.textContent = "Upload 0 Photos";
  bulkUploadDialog.showModal();
  const bulkBody = bulkUploadDialog.querySelector(".dialog-body");
  if (bulkBody) bulkBody.scrollTop = 0;
}

function closeBulkModal() {
  if (bulkUploadDialog && bulkUploadDialog.open) {
    bulkUploadDialog.close();
  }
  bulkSelectedFiles = [];
  if (bulkFileInput) bulkFileInput.value = "";
}

function cleanNameFromFileName(filename) {
  if (!filename) return "Funny Face";
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  const withSpaces = withoutExt.replace(/[_\-.]+/g, " ");
  return withSpaces
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "Funny Face";
}

function handleBulkFilesSelected(files) {
  const validFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
  if (validFiles.length === 0) {
    showToast("Please select valid image files", "error");
    return;
  }

  bulkSelectedFiles = validFiles;
  bulkFilesSummary.textContent = `Selected ${validFiles.length} photo${validFiles.length === 1 ? "" : "s"} ready for upload:`;
  bulkFilesSummary.style.display = "block";

  bulkThumbnailsContainer.innerHTML = "";
  validFiles.slice(0, 30).forEach((file) => {
    const chip = document.createElement("div");
    chip.className = "bulk-thumb-chip";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    img.title = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    chip.appendChild(img);
    bulkThumbnailsContainer.appendChild(chip);
  });

  if (validFiles.length > 30) {
    const moreChip = document.createElement("div");
    moreChip.className = "bulk-thumb-chip more-chip";
    moreChip.textContent = `+${validFiles.length - 30}`;
    bulkThumbnailsContainer.appendChild(moreChip);
  }

  bulkThumbnailsContainer.style.display = "flex";
  startBulkUploadBtn.disabled = false;
  bulkBtnText.textContent = `Upload ${validFiles.length} Photos`;
  bulkErrorMsg.style.display = "none";
}

async function handleStartBulkUpload() {
  if (bulkSelectedFiles.length === 0) return;

  const defaultExpr = (bulkDefaultExpression.value || "").trim() || "Goofy Mood";
  const defaultCap = (bulkDefaultCaption.value || "").trim() || "Caught on camera!";

  startBulkUploadBtn.disabled = true;
  cancelBulkBtn.disabled = true;
  closeBulkDialogBtn.disabled = true;
  bulkSpinner.style.display = "inline-block";
  bulkBtnText.textContent = "Uploading...";
  bulkProgressArea.style.display = "block";
  bulkErrorMsg.style.display = "none";

  try {
    const uploadedImages = await uploadMultipleToCloudinary(
      bulkSelectedFiles,
      ({ current, total, percent, fileName }) => {
        bulkProgressBar.style.width = `${percent}%`;
        bulkProgressPercent.textContent = `${percent}%`;
        bulkProgressLabel.textContent = `Uploading photo ${current} of ${total}...`;
        bulkProgressFilename.textContent = `Current: ${fileName}`;
      }
    );

    bulkProgressLabel.textContent = "Saving all faces to Firestore...";
    bulkProgressBar.style.width = "99%";
    bulkProgressPercent.textContent = "99%";

    const facesPayload = uploadedImages.map(({ file, secureUrl }) => {
      const generatedScore = (8.0 + Math.random() * 1.9).toFixed(1);
      return {
        name: cleanNameFromFileName(file.name),
        expression: defaultExpr,
        funnyScore: generatedScore,
        caption: defaultCap,
        backstory: `Bulk uploaded from file "${file.name}".`,
        image: secureUrl
      };
    });

    const savedCount = await bulkCreateFaces(facesPayload);

    showToast(`Successfully uploaded ${savedCount} funny faces!`, "success");
    closeBulkModal();
  } catch (err) {
    console.error("Bulk upload error:", err);
    bulkErrorMsg.textContent = err.message || "Failed to upload some photos.";
    bulkErrorMsg.style.display = "block";
    bulkErrorMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast(`Bulk upload error: ${err.message}`, "error");
  } finally {
    startBulkUploadBtn.disabled = false;
    cancelBulkBtn.disabled = false;
    closeBulkDialogBtn.disabled = false;
    bulkSpinner.style.display = "none";
    bulkBtnText.textContent = `Upload ${bulkSelectedFiles.length} Photos`;
  }
}

// Admin Authentication Operations
function updateAuthUI() {
  if (isAdmin) {
    if (adminLoginBtn) adminLoginBtn.style.display = "none";
    if (adminStatusPill) adminStatusPill.style.display = "inline-flex";
    if (detailEditBtn) detailEditBtn.style.display = "inline-flex";
    if (detailDeleteBtn) detailDeleteBtn.style.display = "inline-flex";
  } else {
    if (adminLoginBtn) adminLoginBtn.style.display = "inline-flex";
    if (adminStatusPill) adminStatusPill.style.display = "none";
    if (detailEditBtn) detailEditBtn.style.display = "none";
    if (detailDeleteBtn) detailDeleteBtn.style.display = "none";
  }
  filterFaces();
}

function openAdminModal() {
  if (adminLoginError) {
    adminLoginError.style.display = "none";
    adminLoginError.textContent = "";
  }
  if (adminCodeInput) {
    adminCodeInput.value = "";
  }
  if (adminLoginDialog) {
    adminLoginDialog.showModal();
    setTimeout(() => adminCodeInput?.focus(), 50);
  }
}

function closeAdminModal() {
  if (adminLoginDialog && adminLoginDialog.open) {
    adminLoginDialog.close();
  }
  if (adminCodeInput) adminCodeInput.value = "";
  if (adminLoginError) {
    adminLoginError.style.display = "none";
    adminLoginError.textContent = "";
  }
}

function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const enteredCode = (adminCodeInput.value || "").trim();

  if (enteredCode === ADMIN_ACCESS_CODE) {
    isAdmin = true;
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
    } catch {}
    closeAdminModal();
    updateAuthUI();
    showToast("Authenticated as Admin", "success");
  } else {
    if (adminLoginError) {
      adminLoginError.textContent = "Invalid access code";
      adminLoginError.style.display = "block";
    }
  }
}

function handleAdminLogout() {
  isAdmin = false;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
  updateAuthUI();
  showToast("Logged out of Admin Mode", "info");
}

// ==========================================================================
// Live Chat, Face Comments & User Identity Management (Firestore only)
// ==========================================================================

function updateChatUserUI() {
  if (chatUserAvatar) chatUserAvatar.innerHTML = renderAvatarSvg(currentUser.avatar, 18);
  if (chatUserName) chatUserName.textContent = currentUser.name;
}

function updateSoundButtonUI() {
  if (chatSoundIcon) {
    chatSoundIcon.innerHTML = soundEnabled ? icon("bell", { size: 14 }) : icon("bellOff", { size: 14 });
  }
  if (chatSoundBtn) {
    chatSoundBtn.title = soundEnabled ? "Notification sound is ON (click to mute)" : "Notification sound is MUTED (click to enable)";
  }
}

// Convert emoji shortcodes and legacy emoji characters into inline vector SVG badges
function formatRichText(rawText) {
  if (!rawText) return "";
  let escaped = escapeHtml(rawText);

  const REACTION_MAP = [
    { key: ":flame:", svg: icon("flame", { size: 14, className: "inline-icon icon-flame" }) },
    { key: ":zap:", svg: icon("zap", { size: 14, className: "inline-icon icon-zap" }) },
    { key: ":skull:", svg: icon("skull", { size: 14, className: "inline-icon icon-skull" }) },
    { key: ":heart:", svg: icon("heartFilled", { size: 14, className: "inline-icon icon-heart" }) },
    { key: ":laugh:", svg: icon("laugh", { size: 14, className: "inline-icon icon-laugh" }) },
    { key: ":thumbsup:", svg: icon("thumbsUp", { size: 14, className: "inline-icon icon-thumbs" }) },
    { key: ":spark:", svg: icon("spark", { size: 14, className: "inline-icon icon-spark" }) },
    { key: "🔥", svg: icon("flame", { size: 14, className: "inline-icon icon-flame" }) },
    { key: "⚡", svg: icon("zap", { size: 14, className: "inline-icon icon-zap" }) },
    { key: "💀", svg: icon("skull", { size: 14, className: "inline-icon icon-skull" }) },
    { key: "❤️", svg: icon("heartFilled", { size: 14, className: "inline-icon icon-heart" }) },
    { key: "🤍", svg: icon("heartOutline", { size: 14, className: "inline-icon icon-heart" }) },
    { key: "😆", svg: icon("laugh", { size: 14, className: "inline-icon icon-laugh" }) },
    { key: "😂", svg: icon("laugh", { size: 14, className: "inline-icon icon-laugh" }) },
    { key: "👍", svg: icon("thumbsUp", { size: 14, className: "inline-icon icon-thumbs" }) },
    { key: "✨", svg: icon("spark", { size: 14, className: "inline-icon icon-spark" }) },
    { key: "💬", svg: icon("messageCircle", { size: 14, className: "inline-icon icon-chat" }) },
    { key: "🎭", svg: icon("alien", { size: 14, className: "inline-icon icon-alien" }) }
  ];

  for (const item of REACTION_MAP) {
    if (escaped.includes(item.key)) {
      escaped = escaped.split(item.key).join(`<span class="inline-svg-badge" aria-hidden="true">${item.svg}</span>`);
    }
  }

  return escaped;
}

// Render single chat message card HTML
function renderMessageCardHtml(msg) {
  const isMyMsg = msg.sender === currentUser.name;
  const isLiked = isMessageLiked(msg.id);
  const likesCount = typeof msg.likes === "number" ? msg.likes : 0;
  const timeStr = formatTimeAgo(msg.createdAt);
  const messageBody = msg.message || msg.text || "";

  // Check if this message was sent by an AI character
  const isAi = msg.type === "ai" || msg.author_type === "ai" || Boolean(msg.characterId);
  const charInfo = isAi ? getCharacterInfo(msg.characterId || msg.sender) : null;
  const senderDisplayName = charInfo ? charInfo.name : (msg.sender || "Anonymous");
  const avatarKey = charInfo ? charInfo.avatar : (msg.avatar || "alien");

  const faceTag = msg.faceName
    ? `<button type="button" class="chat-msg-tag btn-inspect-tagged-face" data-face-id="${escapeHtml(msg.faceId || '')}" title="Inspect ${escapeHtml(msg.faceName)}">${icon("tag", { size: 11 })} ${escapeHtml(msg.faceName)}</button>`
    : "";

  const aiBadge = isAi
    ? `<span class="ai-chat-badge" title="${charInfo ? charInfo.role : 'Resident AI'}">🤖 AI</span>`
    : "";

  return `
    <div class="chat-msg ${isMyMsg ? 'my-msg' : ''} ${isAi ? 'ai-msg' : ''} ${charInfo ? `ai-msg-${charInfo.id}` : ''}" data-msg-id="${escapeHtml(msg.id)}">
      <div class="chat-avatar ${isAi ? 'chat-avatar-ai' : ''}" aria-hidden="true">${renderAvatarSvg(avatarKey, 18)}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-header">
          <span class="chat-msg-author ${isAi ? 'chat-msg-author-ai' : ''}">${escapeHtml(senderDisplayName)}${aiBadge}${isMyMsg ? ' (You)' : ''}</span>
          <span class="chat-msg-time">${timeStr}</span>
        </div>
        ${faceTag}
        <div class="chat-msg-text">${formatRichText(messageBody)}</div>
        <div class="chat-msg-footer">
          <button type="button" class="chat-like-btn ${isLiked ? 'liked' : ''}" data-msg-id="${escapeHtml(msg.id)}" title="${isLiked ? 'Unlike' : 'Like'} this comment">
            <span class="chat-like-heart" aria-hidden="true">${isLiked ? icon('heartFilled', { size: 12 }) : icon('heartOutline', { size: 12 })}</span>
            <span class="chat-like-count">${likesCount}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Render message cards in live chat feed with high-performance DOM reconciliation
function renderChatMessages(messages) {
  if (!chatMessagesContainer) return;

  if (chatCountPill) chatCountPill.textContent = messages.length;
  if (headerChatBadge) {
    headerChatBadge.textContent = messages.length;
    headerChatBadge.style.display = messages.length > 0 ? "inline-block" : "none";
  }
  if (mobileChatBadge) {
    mobileChatBadge.textContent = messages.length;
    mobileChatBadge.style.display = messages.length > 0 ? "inline-block" : "none";
  }

  // Update AI Status bar text based on conversation state
  const aiStatusText = document.getElementById("ai-chat-status-text");
  if (aiStatusText) {
    const aiMsgs = messages.filter(m => m.type === "ai" || m.author_type === "ai" || m.characterId);
    if (aiMsgs.length > 0) {
      const latestAi = aiMsgs[aiMsgs.length - 1];
      const speakerName = latestAi.characterName || latestAi.sender;
      aiStatusText.textContent = `${speakerName} is arguing in chat`;
    } else {
      aiStatusText.textContent = `AI Crew is online & chatting`;
    }
  }

  if (messages.length === 0) {
    chatMessagesContainer.innerHTML = `
      <div class="chat-empty-feed">
        <span class="empty-chat-icon" aria-hidden="true">${icon("messageCircle", { size: 28 })}</span>
        <strong style="color: var(--text);">No messages yet!</strong>
        <p style="margin: 0; color: var(--text-subtle); font-size: 12px;">Be the first to say something funny or react below.</p>
      </div>
    `;
    return;
  }

  // Check scroll position BEFORE modifying DOM
  const scrollOffset = chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop - chatMessagesContainer.clientHeight;
  const isScrolledToBottom = scrollOffset <= 70;

  const existingCards = chatMessagesContainer.querySelectorAll(".chat-msg[data-msg-id]");
  const isInitialOrEmpty = !hasInitialChatLoaded || existingCards.length === 0;

  if (isInitialOrEmpty) {
    // Initial batch render
    chatMessagesContainer.innerHTML = messages.map(renderMessageCardHtml).join("");
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    return;
  }

  // Efficient Incremental DOM Reconciliation
  const existingMap = new Map();
  existingCards.forEach((el) => {
    existingMap.set(el.getAttribute("data-msg-id"), el);
  });

  const currentIds = new Set();
  let hasNewAppended = false;

  messages.forEach((msg) => {
    currentIds.add(msg.id);
    const existingEl = existingMap.get(msg.id);

    if (existingEl) {
      // Update like count & liked state if changed
      const isLiked = isMessageLiked(msg.id);
      const likesCount = typeof msg.likes === "number" ? msg.likes : 0;
      const countEl = existingEl.querySelector(".chat-like-count");
      const likeBtn = existingEl.querySelector(".chat-like-btn");
      const heartEl = existingEl.querySelector(".chat-like-heart");

      if (countEl && parseInt(countEl.textContent, 10) !== likesCount) {
        countEl.textContent = likesCount;
      }
      if (likeBtn && likeBtn.classList.contains("liked") !== isLiked) {
        likeBtn.classList.toggle("liked", isLiked);
        if (heartEl) {
          heartEl.innerHTML = isLiked ? icon("heartFilled", { size: 12 }) : icon("heartOutline", { size: 12 });
        }
      }
    } else {
      // Append new message card
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = renderMessageCardHtml(msg).trim();
      const newCard = tempDiv.firstElementChild;
      if (newCard) {
        chatMessagesContainer.appendChild(newCard);
        hasNewAppended = true;
      }
    }
  });

  // Remove messages trimmed from collection
  existingMap.forEach((el, id) => {
    if (!currentIds.has(id)) {
      el.remove();
    }
  });

  // Auto-scroll to bottom ONLY if user was already at the bottom or sent their own message
  if (hasNewAppended) {
    const latestMsg = messages[messages.length - 1];
    const isMyLatest = latestMsg && latestMsg.sender === currentUser.name;
    if (isScrolledToBottom || isMyLatest) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  }
}

// Live Chat Subscription
function initLiveChatSubscription() {
  updateChatUserUI();
  updateSoundButtonUI();

  subscribeToLiveChat(
    (messages) => {
      const isNewMessage = hasInitialChatLoaded && messages.length > 0;
      if (isNewMessage) {
        const latest = messages[messages.length - 1];
        if (latest.sender !== currentUser.name) {
          playNotificationSound();
        }
      }

      renderChatMessages(messages);
      hasInitialChatLoaded = true;
    },
    (err) => {
      console.error("Live chat subscription error:", err);
      if (chatMessagesContainer) {
        chatMessagesContainer.innerHTML = `
          <div class="chat-empty-feed">
            <span style="color: var(--danger);">${icon("alertTriangle", { size: 24 })}</span>
            <p style="color: var(--danger); font-size: 12px; margin: 4px 0 0;">Live chat connecting...</p>
          </div>
        `;
      }
    }
  );
}

// Send chat message
async function handleSendChatMessage(e) {
  if (e) e.preventDefault();
  if (!chatInput) return;

  const text = (chatInput.value || "").trim();
  if (!text) return;

  chatInput.value = "";
  
  // Keep keyboard open cleanly on mobile without causing page jump
  if (window.innerWidth <= 1024) {
    chatInput.focus({ preventScroll: true });
  } else {
    chatInput.focus();
  }

  try {
    await sendChatMessage({ text });
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  } catch (err) {
    console.error("Sending chat message failed:", err);
    showToast("Failed to send message. Please try again.", "error");
  }
}

// Mobile Viewport & Drawer Management
let savedBodyScrollY = 0;
let visualViewportRaf = null;

function updateChatVisualViewport() {
  if (!liveChatPanel || !isMobileChatOpen || window.innerWidth > 1024) return;

  const vv = window.visualViewport;
  if (!vv) {
    liveChatPanel.style.setProperty("--chat-vh", "100dvh");
    liveChatPanel.style.setProperty("--chat-top", "0px");
    return;
  }

  const vh = vv.height;
  const offsetTop = vv.offsetTop;

  liveChatPanel.style.setProperty("--chat-vh", `${vh}px`);
  liveChatPanel.style.setProperty("--chat-top", `${offsetTop}px`);

  // Detect virtual keyboard:
  // When keyboard opens, visualViewport.height is significantly reduced
  const fullHeight = window.innerHeight;
  const isKeyboardOpen = (fullHeight - vh) > 100;
  liveChatPanel.classList.toggle("keyboard-open", isKeyboardOpen);

  if (isKeyboardOpen && chatMessagesContainer) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }
}

function onVisualViewportResizeOrScroll() {
  if (!isMobileChatOpen || window.innerWidth > 1024) return;
  if (visualViewportRaf) cancelAnimationFrame(visualViewportRaf);
  visualViewportRaf = requestAnimationFrame(() => {
    visualViewportRaf = null;
    updateChatVisualViewport();
  });
}

// Mobile Chat Drawer Controls
function openMobileChat() {
  if (!liveChatPanel) return;

  savedBodyScrollY = window.scrollY || window.pageYOffset || 0;
  isMobileChatOpen = true;

  liveChatPanel.classList.add("mobile-open");
  if (chatBackdrop) {
    chatBackdrop.style.display = "block";
  }
  document.body.classList.add("mobile-chat-open");

  updateChatVisualViewport();

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onVisualViewportResizeOrScroll, { passive: true });
    window.visualViewport.addEventListener("scroll", onVisualViewportResizeOrScroll, { passive: true });
  }

  requestAnimationFrame(() => {
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  });
}

function closeMobileChat() {
  if (!liveChatPanel) return;

  if (chatInput && document.activeElement === chatInput) {
    chatInput.blur();
  }

  liveChatPanel.classList.remove("mobile-open", "keyboard-open");
  if (chatBackdrop) {
    chatBackdrop.style.display = "none";
  }
  document.body.classList.remove("mobile-chat-open");

  if (window.visualViewport) {
    window.visualViewport.removeEventListener("resize", onVisualViewportResizeOrScroll);
    window.visualViewport.removeEventListener("scroll", onVisualViewportResizeOrScroll);
  }

  if (visualViewportRaf) {
    cancelAnimationFrame(visualViewportRaf);
    visualViewportRaf = null;
  }

  liveChatPanel.style.removeProperty("--chat-vh");
  liveChatPanel.style.removeProperty("--chat-top");

  isMobileChatOpen = false;

  window.scrollTo(0, savedBodyScrollY);
}

function toggleChatPanel() {
  if (window.innerWidth <= 1024) {
    if (isMobileChatOpen) {
      closeMobileChat();
    } else {
      openMobileChat();
    }
  } else {
    // Desktop collapse toggle
    if (appSplitContainer) {
      isChatPanelCollapsed = !isChatPanelCollapsed;
      appSplitContainer.classList.toggle("chat-collapsed", isChatPanelCollapsed);
      if (toggleChatHeaderBtn) {
        toggleChatHeaderBtn.classList.toggle("btn--primary", isChatPanelCollapsed);
      }
    }
  }
}

// Nickname & Avatar Picker Dialog
function openNicknameModal() {
  if (!nicknameDialog) return;
  selectedAvatarChoice = currentUser.avatar;

  if (avatarPickerGrid) {
    avatarPickerGrid.innerHTML = AVATAR_OPTIONS.map((av) => `
      <button type="button" class="avatar-choice-btn ${av.id === selectedAvatarChoice ? 'selected' : ''}" data-avatar="${av.id}" title="Choose ${av.label}">
        ${renderAvatarSvg(av.id, 20)}
        <span class="avatar-choice-label">${av.label}</span>
      </button>
    `).join("");

    avatarPickerGrid.querySelectorAll(".avatar-choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        avatarPickerGrid.querySelectorAll(".avatar-choice-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedAvatarChoice = btn.getAttribute("data-avatar");
      });
    });
  }

  if (nicknameInput) {
    nicknameInput.value = currentUser.name;
  }

  if (nicknameDialog && !nicknameDialog.open) {
    nicknameDialog.showModal();
  }
}

function closeNicknameModal() {
  if (nicknameDialog && nicknameDialog.open) {
    nicknameDialog.close();
  }
}

let isSubmittingNickname = false;
function handleNicknameSubmit(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (isSubmittingNickname) return;
  isSubmittingNickname = true;
  setTimeout(() => { isSubmittingNickname = false; }, 400);

  const name = (nicknameInput ? nicknameInput.value : "").trim();
  if (!name) {
    showToast("Please enter a display name", "error");
    if (nicknameInput) nicknameInput.focus();
    return;
  }

  currentUser = saveCurrentChatUser(name, selectedAvatarChoice);
  updateChatUserUI();
  closeNicknameModal();
  showToast(`Profile updated to ${currentUser.name}!`, "success");
}

function handleRandomizeNickname() {
  const adjectives = ["Goofy", "Cheeky", "Chuckle", "Sneaky", "Jolly", "Silly", "Wobbly", "Quirky", "Snarky", "Witty"];
  const nouns = ["Bob", "Potato", "Penguin", "Panda", "Muffin", "Pickle", "Badger", "Goblin", "Wombat", "Noodle"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900);
  const randomAv = AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)].id;

  if (nicknameInput) nicknameInput.value = `${adj}${noun}${num}`;
  selectedAvatarChoice = randomAv;

  if (avatarPickerGrid) {
    avatarPickerGrid.querySelectorAll(".avatar-choice-btn").forEach((b) => {
      const isMatch = b.getAttribute("data-avatar") === randomAv;
      b.classList.toggle("selected", isMatch);
    });
  }
}

// ==========================================================================
// Today's Mood Banner & Daily Challenge
// ==========================================================================
async function loadTodaysMood(forceRefresh = false) {
  if (!todaysMoodBanner || !todaysMoodText) return;
  try {
    const res = await fetch("/api/ai/mood" + (forceRefresh ? "?refresh=1" : ""), {
      method: forceRefresh ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: forceRefresh ? JSON.stringify({ forceRefresh: true }) : undefined
    });
    const data = await res.json();
    if (data.success && data.mood) {
      activeMood = data.mood;
      todaysMoodText.textContent = data.mood.summary || "Unhinged energy across the board today.";
      todaysMoodBanner.style.display = "flex";
    }
  } catch (err) {
    console.warn("Could not load mood:", err);
  }
}

async function loadDailyChallenge() {
  if (!dailyChallengeCard || !challengePromptText) return;
  try {
    const res = await fetch("/api/ai/challenge");
    const data = await res.json();
    if (data.success && data.challenge) {
      activeChallenge = data.challenge;
      dailyChallengeCard.style.display = "block";
      if (challengeHostTag) challengeHostTag.textContent = `${data.challenge.host || 'Critic'}'s Challenge`;
      challengePromptText.textContent = `"${data.challenge.prompt}"`;

      if (data.challenge.faceId) {
        const matched = allFaces.find(f => f.id === data.challenge.faceId);
        if (matched && challengeFacePreview) {
          challengeFacePreview.src = getOptimizedImageUrl(matched.image, { width: 140, height: 140 });
          challengeFacePreview.style.display = "block";
        }
      }

      if (data.challenge.verdict && challengeVerdictBox) {
        challengeVerdictBox.style.display = "block";
        challengeVerdictBox.innerHTML = `<strong>🏆 Critic's Verdict:</strong> ${escapeHtml(data.challenge.verdict)}`;
      }
    }
  } catch (err) {
    console.warn("Could not load daily challenge:", err);
  }
}

// ==========================================================================
// Hall of Fame Modal
// ==========================================================================
function openHallOfFame() {
  if (!hallOfFameDialog) return;

  const validFaces = allFaces.filter(f => !f.hidden);
  if (validFaces.length === 0) {
    showToast("No faces available yet for Hall of Fame.", "info");
    return;
  }

  // Top by Likes
  const byLikes = [...validFaces].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0)).slice(0, 3);
  if (hofTopLikes) {
    hofTopLikes.innerHTML = byLikes.map((f, i) => `
      <div class="hof-rank-item" data-face-id="${escapeHtml(f.id)}">
        <span class="hof-rank-num" style="color: ${i === 0 ? '#fbbf24' : 'var(--text-muted)'};">#${i + 1}</span>
        <img class="hof-rank-thumb" src="${escapeHtml(getOptimizedImageUrl(f.image, { width: 88, height: 88 }))}" alt="${escapeHtml(f.name)}">
        <div style="flex: 1; min-width: 0;">
          <strong style="display: block; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(f.name)}</strong>
          <span style="font-size: 11.5px; color: #f43f5e; font-weight: 600;">❤️ ${f.likesCount || 0} likes</span>
        </div>
      </div>
    `).join("");
  }

  // Top by Rating
  const byRating = [...validFaces].sort((a, b) => parseFloat(b.funnyScore || 0) - parseFloat(a.funnyScore || 0)).slice(0, 3);
  if (hofTopRating) {
    hofTopRating.innerHTML = byRating.map((f, i) => `
      <div class="hof-rank-item" data-face-id="${escapeHtml(f.id)}">
        <span class="hof-rank-num" style="color: ${i === 0 ? '#fbbf24' : 'var(--text-muted)'};">#${i + 1}</span>
        <img class="hof-rank-thumb" src="${escapeHtml(getOptimizedImageUrl(f.image, { width: 88, height: 88 }))}" alt="${escapeHtml(f.name)}">
        <div style="flex: 1; min-width: 0;">
          <strong style="display: block; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(f.name)}</strong>
          <span style="font-size: 11.5px; color: #fbbf24; font-weight: 600;">⭐ ${f.funnyScore || '0'} / 10</span>
        </div>
      </div>
    `).join("");
  }

  // Top by Critic Score
  const byCritic = [...validFaces]
    .filter(f => f.ai_extras && f.ai_extras.criticScore)
    .sort((a, b) => parseFloat(b.ai_extras.criticScore || 0) - parseFloat(a.ai_extras.criticScore || 0))
    .slice(0, 3);
  if (hofTopCritic) {
    hofTopCritic.innerHTML = (byCritic.length > 0 ? byCritic : byRating).map((f, i) => `
      <div class="hof-rank-item" data-face-id="${escapeHtml(f.id)}">
        <span class="hof-rank-num" style="color: ${i === 0 ? '#fbbf24' : 'var(--text-muted)'};">#${i + 1}</span>
        <img class="hof-rank-thumb" src="${escapeHtml(getOptimizedImageUrl(f.image, { width: 88, height: 88 }))}" alt="${escapeHtml(f.name)}">
        <div style="flex: 1; min-width: 0;">
          <strong style="display: block; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(f.name)}</strong>
          <span style="font-size: 11.5px; color: #818cf8; font-weight: 600;">🎩 ${f.ai_extras?.criticScore || f.funnyScore || '0'} / 10</span>
        </div>
      </div>
    `).join("");
  }

  // Face of the Week Spotlight
  const legend = byLikes[0] || validFaces[0];
  if (legend) {
    if (hofWeekTitle) hofWeekTitle.textContent = legend.name;
    if (hofWeekImg) hofWeekImg.src = getOptimizedImageUrl(legend.image, { width: 280, height: 280 });
    if (hofWeekAnnouncement) {
      hofWeekAnnouncement.textContent = legend.ai_extras?.vibeLine
        ? `Gossip: "Pure ${legend.ai_extras.vibeLine}! Crowned champion of unhinged moments this week!"`
        : `"Reigning face of the week with ${legend.likesCount || 0} community likes!"`;
    }
    if (hofWeekImgWrap) {
      hofWeekImgWrap.onclick = () => {
        closeHallOfFame();
        openDetails(legend);
      };
    }
  }

  hallOfFameDialog.showModal();
}

function closeHallOfFame() {
  if (hallOfFameDialog && hallOfFameDialog.open) {
    hallOfFameDialog.close();
  }
}

// ==========================================================================
// AI Crew Dialog
// ==========================================================================
function updateAiCrewFollowUI() {
  if (followGossipBtn) {
    const isFollowing = followedResidents.includes("gossip");
    followGossipBtn.innerHTML = isFollowing ? `<span>❤️ Following Gossip</span>` : `<span>🤍 Follow Gossip</span>`;
    followGossipBtn.classList.toggle("btn--primary", isFollowing);
    followGossipBtn.classList.toggle("btn--secondary", !isFollowing);
  }
  if (followCriticBtn) {
    const isFollowing = followedResidents.includes("critic");
    followCriticBtn.innerHTML = isFollowing ? `<span>🎩 Following Critic</span>` : `<span>🤍 Follow Critic</span>`;
    followCriticBtn.classList.toggle("btn--primary", isFollowing);
    followCriticBtn.classList.toggle("btn--secondary", !isFollowing);
  }
}

function openAICrew() {
  if (!aiCrewDialog) return;
  const cardsContainer = document.getElementById("ai-crew-cards-container");
  if (cardsContainer) {
    cardsContainer.innerHTML = Object.values(AI_CHARACTERS).map(char => {
      return `
        <div class="ai-profile-card ai-card-${escapeHtml(char.id)}">
          <div class="ai-profile-avatar-wrap">
            <div class="ai-profile-vector-avatar" style="color: var(--ink);">
              ${renderAvatarSvg(char.avatar, 38)}
            </div>
            <span class="ai-online-dot" title="Online in Live Chat"></span>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <h3 style="margin: 0; font-size: 18px;">${escapeHtml(char.name)}</h3>
            <span class="ai-badge">🤖 AI</span>
          </div>
          <p style="margin: 4px 0 6px; font-size: 13px; color: var(--soft); font-weight: 700;">${escapeHtml(char.role)}</p>
          <div>
            <span class="ai-provider-pill" style="font-size: 11px; padding: 2px 8px; border: 1.5px solid var(--ink); border-radius: var(--wob2); background: var(--paper); font-weight: 600; text-transform: uppercase;">Powered by ${escapeHtml(char.provider)}</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.45; margin: 10px 0 14px;">
            ${escapeHtml(char.desc)}
          </p>

          <div style="text-align: left; font-size: 12px; margin-bottom: 16px; background: var(--paper); padding: 10px; border: 1.5px solid var(--ink); border-radius: var(--wob2); flex: 1;">
            <p style="margin: 3px 0; color: var(--ink);"><strong>Loves:</strong> <span style="color: var(--soft);">${escapeHtml(char.loves)}</span></p>
            <p style="margin: 3px 0; color: var(--ink);"><strong>Never does:</strong> <span style="color: var(--soft);">${escapeHtml(char.neverDoes)}</span></p>
          </div>

          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn--secondary btn--sm btn-say-hi-crew" data-char-name="${escapeHtml(char.name)}" style="flex: 1;">
              <span>💬 Mention @${escapeHtml(char.name)}</span>
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Wire up mention buttons
    cardsContainer.querySelectorAll(".btn-say-hi-crew").forEach(btn => {
      btn.addEventListener("click", () => {
        const charName = btn.dataset.charName;
        if (charName && chatInput) {
          closeAICrew();
          chatInput.value = `@${charName} `;
          chatInput.focus();
        }
      });
    });
  }

  aiCrewDialog.showModal();
}

function closeAICrew() {
  if (aiCrewDialog && aiCrewDialog.open) {
    aiCrewDialog.close();
  }
}

// ==========================================================================
// Notifications System
// ==========================================================================
function renderNotifications() {
  const notifs = getStoredNotifications();
  const unreadCount = notifs.filter(n => n.unread).length;

  if (notificationsBadge) {
    notificationsBadge.textContent = unreadCount;
    notificationsBadge.style.display = unreadCount > 0 ? "inline-flex" : "none";
  }

  if (!notificationsList) return;

  if (notifs.length === 0) {
    notificationsList.innerHTML = `
      <div style="text-align: center; padding: 24px 12px; color: var(--text-muted); font-size: 12.5px;">
        <p style="margin: 0;">No notifications yet.</p>
        <span style="font-size: 11px; color: var(--text-subtle);">You will be alerted when an AI or visitor replies to you!</span>
      </div>
    `;
    return;
  }

  notificationsList.innerHTML = notifs.map(n => `
    <div class="notification-item ${n.unread ? 'unread' : ''}" data-face-id="${escapeHtml(n.linkFaceId || '')}">
      <div style="flex: 1;">
        <div style="font-size: 12.5px; font-weight: 700; color: var(--text);">${escapeHtml(n.title)}</div>
        <p style="margin: 2px 0 0; font-size: 12px; color: var(--text-secondary);">${escapeHtml(n.message)}</p>
        <span style="font-size: 10px; color: var(--text-subtle);">${formatTimeAgo(n.timestamp)}</span>
      </div>
    </div>
  `).join("");
}

// ==========================================================================
// Admin Dashboard
// ==========================================================================
async function openAdminDashboard() {
  if (!adminDashboardDialog) return;
  if (!isAdmin) {
    showToast("Admin authentication required.", "error");
    openAdminModal();
    return;
  }

  try {
    const res = await fetch(`/api/ai/settings?adminCode=${ADMIN_ACCESS_CODE}`);
    const data = await res.json();
    if (data.success) {
      const s = data.settings || {};
      if (adminAiMasterToggle) adminAiMasterToggle.checked = s.ai_enabled !== false;
      if (adminRoastDefaultToggle) adminRoastDefaultToggle.checked = s.roast_default !== false;
      if (adminDailyCapSlider) {
        adminDailyCapSlider.value = s.daily_cap || 150;
        if (adminCapDisplay) adminCapDisplay.textContent = `${s.daily_cap || 150} calls`;
      }
      if (adminReplyProbSlider) {
        const prob = s.reply_probability !== undefined ? Math.round(s.reply_probability * 100) : 60;
        adminReplyProbSlider.value = prob;
        if (adminProbDisplay) adminProbDisplay.textContent = `${prob}%`;
      }
      if (adminCallsTodayCount) adminCallsTodayCount.textContent = s.calls_today || 0;
      if (adminCostCounter) adminCostCounter.textContent = ((s.calls_today || 0) * 0.00015).toFixed(4);
      if (adminPendingQueueCount) adminPendingQueueCount.textContent = data.stats?.pendingJobsCount || 0;

      // Render recent AI comments
      if (adminAiCommentsTbody && data.stats?.recentAiComments) {
        if (data.stats.recentAiComments.length === 0) {
          adminAiCommentsTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 12px;">No AI comments found yet.</td></tr>`;
        } else {
          adminAiCommentsTbody.innerHTML = data.stats.recentAiComments.map(c => `
            <tr>
              <td><span class="ai-badge">${escapeHtml(c.sender || 'AI')}</span></td>
              <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.text)}</td>
              <td style="font-size: 11px; color: var(--text-muted);">${formatTimeAgo(c.createdAt)}</td>
              <td>
                <button type="button" class="btn btn--danger btn--xs btn-admin-del-comment" data-comment-id="${escapeHtml(c.id)}">Delete</button>
              </td>
            </tr>
          `).join("");
        }
      }

    }
  } catch (err) {
    console.error("Failed to load admin AI settings:", err);
    showToast("Error loading admin settings.", "error");
  }

  adminDashboardDialog.showModal();
}

function closeAdminDashboard() {
  if (adminDashboardDialog && adminDashboardDialog.open) {
    adminDashboardDialog.close();
  }
}


// Register all Event Listeners
function setupEventListeners() {
  addFaceBtn.addEventListener("click", () => openFormModal("create"));
  emptyAddBtn.addEventListener("click", () => openFormModal("create"));

  // Feed Filter Pills
  filterPillBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterPillBtns.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      currentFilter = btn.dataset.filter || "all";
      filterFaces();
    });
  });

  // App Navigation Active States (Bottom nav & sidebar)
  const navContainer = document.getElementById("app-nav");
  if (navContainer) {
    navContainer.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      navContainer.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
    });
  }

  const navHomeBtn = document.getElementById("nav-home-btn");
  if (navHomeBtn) {
    navHomeBtn.addEventListener("click", () => {
      currentFilter = "all";
      filterPillBtns.forEach(b => {
        b.classList.toggle("active", b.dataset.filter === "all");
        b.setAttribute("aria-selected", String(b.dataset.filter === "all"));
      });
      filterFaces();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const navAddBtn = document.getElementById("nav-add-btn");
  if (navAddBtn) {
    navAddBtn.addEventListener("click", () => openFormModal("create"));
  }

  // Navigation Links
  if (navHallOfFameBtn) navHallOfFameBtn.addEventListener("click", openHallOfFame);
  if (closeHofBtn) closeHofBtn.addEventListener("click", closeHallOfFame);
  if (dismissHofBtn) dismissHofBtn.addEventListener("click", closeHallOfFame);

  if (navAiCrewBtn) navAiCrewBtn.addEventListener("click", openAICrew);
  if (closeCrewBtn) closeCrewBtn.addEventListener("click", closeAICrew);
  if (dismissCrewBtn) dismissCrewBtn.addEventListener("click", closeAICrew);

  if (followGossipBtn) {
    followGossipBtn.addEventListener("click", () => {
      const idx = followedResidents.indexOf("gossip");
      if (idx >= 0) {
        followedResidents.splice(idx, 1);
        showToast("Unfollowed Gossip", "info");
      } else {
        followedResidents.push("gossip");
        showToast("Following Gossip! You'll get hype updates.", "success");
      }
      localStorage.setItem("minwtf_followed_ai", JSON.stringify(followedResidents));
      updateAiCrewFollowUI();
    });
  }

  if (followCriticBtn) {
    followCriticBtn.addEventListener("click", () => {
      const idx = followedResidents.indexOf("critic");
      if (idx >= 0) {
        followedResidents.splice(idx, 1);
        showToast("Unfollowed Critic", "info");
      } else {
        followedResidents.push("critic");
        showToast("Following Critic! Expect deadpan reviews.", "success");
      }
      localStorage.setItem("minwtf_followed_ai", JSON.stringify(followedResidents));
      updateAiCrewFollowUI();
    });
  }

  if (filterGossipFeedBtn) {
    filterGossipFeedBtn.addEventListener("click", () => {
      closeAICrew();
      currentFilter = "by-gossip";
      filterPillBtns.forEach(b => {
        const match = b.dataset.filter === "by-gossip";
        b.classList.toggle("active", match);
        b.setAttribute("aria-selected", String(match));
      });
      filterFaces();
      facesContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (filterCriticFeedBtn) {
    filterCriticFeedBtn.addEventListener("click", () => {
      closeAICrew();
      currentFilter = "by-critic";
      filterPillBtns.forEach(b => {
        const match = b.dataset.filter === "by-critic";
        b.classList.toggle("active", match);
        b.setAttribute("aria-selected", String(match));
      });
      filterFaces();
      facesContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Hall of Fame rank clicks
  [hofTopLikes, hofTopRating, hofTopCritic].forEach(col => {
    if (col) {
      col.addEventListener("click", (e) => {
        const item = e.target.closest(".hof-rank-item");
        if (item) {
          const faceId = item.dataset.faceId;
          const match = allFaces.find(f => f.id === faceId);
          if (match) {
            closeHallOfFame();
            openDetails(match);
          }
        }
      });
    }
  });

  // Notifications Popover & List
  if (notificationsBellBtn) {
    notificationsBellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (notificationsPopover) {
        notificationsPopover.classList.toggle("active");
        renderNotifications();
      }
    });
  }
  if (clearNotificationsBtn) {
    clearNotificationsBtn.addEventListener("click", () => {
      clearStoredNotifications();
      renderNotifications();
      showToast("Notifications cleared", "info");
    });
  }
  document.addEventListener("click", (e) => {
    if (notificationsPopover && !notificationsPopover.contains(e.target) && !notificationsBellBtn?.contains(e.target)) {
      notificationsPopover.classList.remove("active");
    }
  });
  if (notificationsList) {
    notificationsList.addEventListener("click", (e) => {
      const item = e.target.closest(".notification-item");
      if (item) {
        const faceId = item.dataset.faceId;
        if (faceId) {
          const match = allFaces.find(f => f.id === faceId);
          if (match) {
            if (notificationsPopover) notificationsPopover.classList.remove("active");
            openDetails(match);
          }
        }
      }
    });
  }

  // Today's Mood & Daily Challenge
  if (refreshMoodBtn) {
    refreshMoodBtn.addEventListener("click", async () => {
      refreshMoodBtn.disabled = true;
      showToast("Updating Today's Mood recap with Gossip...", "info");
      await loadTodaysMood(true);
      refreshMoodBtn.disabled = false;
      showToast("Today's mood updated!", "success");
    });
  }

  if (viewChallengeBtn) {
    viewChallengeBtn.addEventListener("click", () => {
      if (activeChallenge?.faceId) {
        const match = allFaces.find(f => f.id === activeChallenge.faceId);
        if (match) {
          openDetails(match, true);
        } else {
          showToast("Challenge face not found in current list", "info");
        }
      } else {
        showToast("Open any face and post your funniest caption!", "info");
      }
    });
  }

  // Admin Dashboard Controls
  if (adminDashboardBtn) adminDashboardBtn.addEventListener("click", openAdminDashboard);
  if (closeAdminDashBtn) closeAdminDashBtn.addEventListener("click", closeAdminDashboard);
  if (closeAdminDashFooterBtn) closeAdminDashFooterBtn.addEventListener("click", closeAdminDashboard);

  if (adminDailyCapSlider && adminCapDisplay) {
    adminDailyCapSlider.addEventListener("input", (e) => {
      adminCapDisplay.textContent = `${e.target.value} calls`;
    });
  }

  if (adminReplyProbSlider && adminProbDisplay) {
    adminReplyProbSlider.addEventListener("input", (e) => {
      adminProbDisplay.textContent = `${e.target.value}%`;
    });
  }

  if (saveAiSettingsBtn) {
    saveAiSettingsBtn.addEventListener("click", async () => {
      saveAiSettingsBtn.disabled = true;
      try {
        const res = await fetch("/api/ai/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminCode: ADMIN_ACCESS_CODE,
            action: "update_settings",
            settings: {
              ai_enabled: adminAiMasterToggle ? adminAiMasterToggle.checked : true,
              roast_default: adminRoastDefaultToggle ? adminRoastDefaultToggle.checked : true,
              daily_cap: parseInt(adminDailyCapSlider?.value || "150", 10),
              reply_probability: parseFloat((parseInt(adminReplyProbSlider?.value || "60", 10) / 100).toFixed(2))
            }
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast("AI settings successfully updated!", "success");
        } else {
          showToast(data.error || "Failed to update settings", "error");
        }
      } catch {
        showToast("Network error updating AI settings", "error");
      } finally {
        saveAiSettingsBtn.disabled = false;
      }
    });
  }

  if (adminResetCostBtn) {
    adminResetCostBtn.addEventListener("click", async () => {
      if (confirm("Reset today's API call counter back to 0?")) {
        try {
          const res = await fetch("/api/ai/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adminCode: ADMIN_ACCESS_CODE,
              action: "reset_cost"
            })
          });
          const data = await res.json();
          if (data.success) {
            if (adminCallsTodayCount) adminCallsTodayCount.textContent = "0";
            if (adminCostCounter) adminCostCounter.textContent = "0.000";
            showToast("Counter reset to 0.", "info");
          }
        } catch {
          showToast("Failed to reset counter.", "error");
        }
      }
    });
  }

  if (adminRunQueueBtn) {
    adminRunQueueBtn.addEventListener("click", async () => {
      adminRunQueueBtn.disabled = true;
      adminRunQueueBtn.textContent = "Processing...";
      try {
        const res = await fetch("/api/ai/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "process" })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Processed ${data.processedCount || 0} queue jobs.`, "success");
          if (adminPendingQueueCount) adminPendingQueueCount.textContent = "0";
        }
      } catch {
        showToast("Error processing queue", "error");
      } finally {
        adminRunQueueBtn.disabled = false;
        adminRunQueueBtn.textContent = "Process Queue";
      }
    });
  }

  if (adminAiCommentsTbody) {
    adminAiCommentsTbody.addEventListener("click", async (e) => {
      const delBtn = e.target.closest(".btn-admin-del-comment");
      if (delBtn) {
        const commentId = delBtn.dataset.commentId;
        if (confirm("Permanently delete this comment?")) {
          try {
            const res = await fetch("/api/ai/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                adminCode: ADMIN_ACCESS_CODE,
                action: "delete_comment",
                commentId
              })
            });
            const data = await res.json();
            if (data.success) {
              delBtn.closest("tr")?.remove();
              showToast("Comment deleted.", "info");
            }
          } catch {
            showToast("Failed to delete comment.", "error");
          }
        }
      }
    });
  }


  // Admin Auth Listeners
  if (adminLoginBtn) adminLoginBtn.addEventListener("click", openAdminModal);
  if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", handleAdminLogout);
  if (closeAdminDialogBtn) closeAdminDialogBtn.addEventListener("click", closeAdminModal);
  if (cancelAdminDialogBtn) cancelAdminDialogBtn.addEventListener("click", closeAdminModal);
  if (adminLoginForm) adminLoginForm.addEventListener("submit", handleAdminLoginSubmit);

  // Live Chat Listeners
  if (chatForm) chatForm.addEventListener("submit", handleSendChatMessage);

  // Quick Reaction Icon buttons
  quickEmojiBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const reaction = btn.getAttribute("data-reaction") || btn.getAttribute("data-emoji");
      if (chatInput && reaction) {
        const val = chatInput.value || "";
        chatInput.value = val ? (val.endsWith(" ") ? val + reaction : val + " " + reaction) : reaction;
        if (window.innerWidth > 1024) {
          chatInput.focus();
        } else if (document.activeElement === chatInput) {
          chatInput.focus({ preventScroll: true });
        }
      }
    });
  });

  // Chat message delegated clicks (likes & tagged face inspections)
  if (chatMessagesContainer) {
    chatMessagesContainer.addEventListener("click", async (e) => {
      const faceTagBtn = e.target.closest(".btn-inspect-tagged-face");
      if (faceTagBtn) {
        const targetId = faceTagBtn.getAttribute("data-face-id");
        const matchedFace = allFaces.find((f) => f.id === targetId);
        if (matchedFace) {
          openDetails(matchedFace);
        }
        return;
      }

      const likeBtn = e.target.closest(".chat-like-btn");
      if (!likeBtn) return;
      const msgId = likeBtn.getAttribute("data-msg-id");
      if (!msgId) return;

      try {
        const newlyLiked = await toggleMessageLike(msgId);
        const heartEl = likeBtn.querySelector(".chat-like-heart");
        const countEl = likeBtn.querySelector(".chat-like-count");
        let count = parseInt(countEl ? countEl.textContent : "0", 10) || 0;
        likeBtn.classList.toggle("liked", newlyLiked);
        if (heartEl) {
          heartEl.innerHTML = newlyLiked ? icon("heartFilled", { size: 12 }) : icon("heartOutline", { size: 12 });
          if (newlyLiked) heartEl.classList.add("like-anim");
        }
        if (countEl) countEl.textContent = newlyLiked ? count + 1 : Math.max(0, count - 1);
      } catch (err) {
        console.error("Message like error:", err);
      }
    });
  }

  // Mobile keyboard focus & blur management
  if (chatInput) {
    chatInput.addEventListener("focus", () => {
      if (window.innerWidth <= 1024 && isMobileChatOpen) {
        liveChatPanel.classList.add("keyboard-open");
        setTimeout(() => {
          window.scrollTo(0, 0);
          updateChatVisualViewport();
          if (chatMessagesContainer) {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
          }
        }, 60);
      }
    });

    chatInput.addEventListener("blur", () => {
      if (window.innerWidth <= 1024 && isMobileChatOpen) {
        setTimeout(() => {
          window.scrollTo(0, 0);
          updateChatVisualViewport();
        }, 60);
      }
    });
  }

  // Handle window resize & orientation change across breakpoints
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) {
      if (isMobileChatOpen) {
        closeMobileChat();
      }
    } else if (isMobileChatOpen) {
      updateChatVisualViewport();
    }
  }, { passive: true });

  // Escape key to dismiss mobile drawer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMobileChatOpen) {
      closeMobileChat();
    }
  });

  // Toggle Live Chat from Header and Mobile FAB
  if (toggleChatHeaderBtn) toggleChatHeaderBtn.addEventListener("click", toggleChatPanel);
  if (mobileChatFab) mobileChatFab.addEventListener("click", openMobileChat);
  if (chatCloseMobileBtn) chatCloseMobileBtn.addEventListener("click", closeMobileChat);
  if (chatBackdrop) chatBackdrop.addEventListener("click", closeMobileChat);

  // Desktop Collapse Button
  if (chatCollapseBtn) {
    chatCollapseBtn.addEventListener("click", () => {
      if (appSplitContainer) {
        isChatPanelCollapsed = true;
        appSplitContainer.classList.add("chat-collapsed");
        if (toggleChatHeaderBtn) {
          toggleChatHeaderBtn.classList.add("btn--primary");
        }
        showToast("Live chat panel collapsed. Click Live Chat in header to reopen anytime.", "info");
      }
    });
  }

  // Sound Toggle Button
  if (chatSoundBtn) {
    chatSoundBtn.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      try {
        localStorage.setItem(STORAGE_KEY_SOUND, String(soundEnabled));
      } catch {}
      updateSoundButtonUI();
      showToast(soundEnabled ? "Chat sound effects enabled" : "Chat sound muted", "info");
    });
  }

  // User Profile / Nickname pill click
  if (chatUserPill) chatUserPill.addEventListener("click", openNicknameModal);
  if (closeNicknameDialogBtn) closeNicknameDialogBtn.addEventListener("click", closeNicknameModal);
  if (cancelNicknameBtn) cancelNicknameBtn.addEventListener("click", closeNicknameModal);
  if (nicknameForm) nicknameForm.addEventListener("submit", handleNicknameSubmit);
  const saveNicknameBtn = document.getElementById("save-nickname-btn");
  if (saveNicknameBtn) {
    saveNicknameBtn.addEventListener("click", (e) => {
      if (nicknameForm && nicknameForm.checkValidity && !nicknameForm.checkValidity()) {
        nicknameForm.reportValidity();
        return;
      }
      handleNicknameSubmit(e);
    });
  }
  if (randomizeNicknameBtn) randomizeNicknameBtn.addEventListener("click", handleRandomizeNickname);

  // Bulk upload listeners
  if (bulkUploadBtn) bulkUploadBtn.addEventListener("click", openBulkModal);
  if (emptyBulkBtn) emptyBulkBtn.addEventListener("click", openBulkModal);
  if (closeBulkDialogBtn) closeBulkDialogBtn.addEventListener("click", closeBulkModal);
  if (cancelBulkBtn) cancelBulkBtn.addEventListener("click", closeBulkModal);
  if (startBulkUploadBtn) startBulkUploadBtn.addEventListener("click", handleStartBulkUpload);

  if (bulkFileInput) {
    bulkFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleBulkFilesSelected(e.target.files);
      }
    });
  }

  if (bulkUploadDropzone) {
    ["dragenter", "dragover"].forEach((eventName) => {
      bulkUploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bulkUploadDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      bulkUploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bulkUploadDropzone.classList.remove("dragover");
      });
    });

    bulkUploadDropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleBulkFilesSelected(e.dataTransfer.files);
      }
    });
  }

  searchInput.addEventListener("input", filterFaces);

  faceScoreInput.addEventListener("input", (e) => {
    scoreDisplay.textContent = `${e.target.value} / 10`;
  });

  faceForm.addEventListener("submit", handleFormSubmit);
  closeFormBtn.addEventListener("click", closeFormModal);
  cancelFormBtn.addEventListener("click", closeFormModal);

  closeDialogBtn.addEventListener("click", closeDetails);
  detailCloseBtn.addEventListener("click", closeDetails);
  detailEditBtn.addEventListener("click", () => {
    if (!isAdmin) {
      showToast("Admin authentication required to edit faces.", "error");
      return;
    }
    const face = activeFaceForDetails;
    closeDetails();
    if (face) openFormModal("edit", face);
  });
  detailDeleteBtn.addEventListener("click", () => {
    if (!isAdmin) {
      showToast("Admin authentication required to delete faces.", "error");
      return;
    }
    const face = activeFaceForDetails;
    if (face) promptDelete(face);
  });

  closeDeleteDialogBtn.addEventListener("click", closeDeleteModal);
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  confirmDeleteBtn.addEventListener("click", handleDeleteConfirm);

  // Close dialog on backdrop click
  [
    detailsDialog,
    faceFormDialog,
    deleteConfirmDialog,
    bulkUploadDialog,
    adminLoginDialog,
    nicknameDialog,
    hallOfFameDialog,
    aiCrewDialog,
    adminDashboardDialog
  ].forEach((dialog) => {
    if (!dialog) return;
    dialog.addEventListener("click", (e) => {
      const rect = dialog.getBoundingClientRect();
      const inDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!inDialog) {
        if (dialog === detailsDialog) {
          closeDetails();
        } else if (dialog === hallOfFameDialog) {
          closeHallOfFame();
        } else if (dialog === aiCrewDialog) {
          closeAICrew();
        } else if (dialog === adminDashboardDialog) {
          closeAdminDashboard();
        } else if (dialog && dialog.open) {
          dialog.close();
        }
      }
    });
  });

  setupUploadDropzone();
}

// Initialize Application
function initApp() {
  initTheme();
  checkConfiguration();
  setupEventListeners();
  updateAuthUI();
  initLiveChatSubscription();
  loadTodaysMood();
  renderNotifications();

  subscribeToFaces(
    (faces) => {
      allFaces = faces;
      loadingState.style.display = "none";
      filterFaces();
      loadDailyChallenge();
    },
    (err) => {
      loadingState.style.display = "none";
      facesCounter.textContent = "Failed to load faces";
      showToast(`Firestore error: ${err.message}`, "error");
    }
  );

  // Opportunistic background heartbeat for AI group chat (runs every 60s while browser is active)
  setTimeout(() => triggerAiChatTick(), 4000);
  setInterval(() => triggerAiChatTick(), 60000);
}

// Start
initApp();

