// Main Application Logic - Modern Dark Edition
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
  STORAGE_KEY_SOUND
} from "./services/chat-service.js";
import { icon, renderAvatarSvg, AVATAR_OPTIONS } from "./services/icons.js";

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
const themeBtn = document.getElementById("themebtn");
const toastDock = document.getElementById("toastdock");

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

// Theme management
function initTheme() {
  const root = document.documentElement;
  
  function applyTheme(mode) {
    if (mode === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
    const isDark = root.getAttribute("data-theme") !== "light";
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", String(isDark));
    }
  }

  try {
    const saved = localStorage.getItem("funny-faces-theme");
    applyTheme(saved || "dark");
  } catch {
    applyTheme("dark");
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      applyTheme(next);
      try {
        localStorage.setItem("funny-faces-theme", next);
      } catch {}
    });
  }
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
    card.className = "face-card";

    // Deliver optimized thumbnail size for cards
    const thumbUrl = getOptimizedImageUrl(face.image, { width: 560, height: 420, fit: "fill" });

    const isLiked = isFaceLiked(face.id);
    const likesCount = typeof face.likesCount === "number" ? face.likesCount : 0;
    const commentsCount = typeof face.commentsCount === "number" ? face.commentsCount : 0;

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
        <button type="button" class="btn-icon btn-edit" title="Edit face" aria-label="Edit ${escapeHtml(face.name)}">${icon('pencil', { size: 13 })}</button>
        <button type="button" class="btn-icon btn-delete" title="Delete face" aria-label="Delete ${escapeHtml(face.name)}">${icon('trash', { size: 13 })}</button>
      `
      : `
        <button type="button" class="btn btn--secondary btn--sm btn-detail">Inspect</button>
        ${socialControls}
      `;

    card.innerHTML = `
      <div class="card-img-wrapper" title="Click to view details">
        <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(face.name)}" loading="lazy" width="280" height="210">
        <div class="card-badges">
          <span class="badge badge-category" title="${escapeHtml(face.expression || 'Funny')}">${escapeHtml(face.expression || 'Funny')}</span>
          <span class="badge badge-score" title="Rating">${icon('star', { size: 11 })} ${escapeHtml(face.funnyScore || '0')}</span>
        </div>
      </div>
      <div class="card-content">
        <h3 class="card-title" title="Click to view details">${escapeHtml(face.name)}</h3>
        <p class="card-caption">${escapeHtml(face.caption ? `"${face.caption}"` : "")}</p>
        <div class="card-actions">
          ${actionButtons}
        </div>
      </div>
    `;

    // Click on image or title or Inspect button -> Open Detail
    const openDetailTrigger = () => openDetails(face);
    card.querySelector(".card-img-wrapper").addEventListener("click", openDetailTrigger);
    card.querySelector(".card-title").addEventListener("click", openDetailTrigger);
    card.querySelector(".btn-detail").addEventListener("click", openDetailTrigger);

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

// Filter faces based on search
function filterFaces() {
  const query = (searchInput.value || "").toLowerCase().trim();
  if (!query) {
    renderCards(allFaces);
    return;
  }

  const filtered = allFaces.filter((face) => {
    const nameMatch = (face.name || "").toLowerCase().includes(query);
    const exprMatch = (face.expression || "").toLowerCase().includes(query);
    const capMatch = (face.caption || "").toLowerCase().includes(query);
    const storyMatch = (face.backstory || "").toLowerCase().includes(query);
    return nameMatch || exprMatch || capMatch || storyMatch;
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
function openDetails(face, shouldFocusComments = false) {
  activeFaceForDetails = face;
  detailTitle.textContent = face.name;

  // Clean up any previous comments listener
  if (activeFaceCommentsUnsubscribe) {
    activeFaceCommentsUnsubscribe();
    activeFaceCommentsUnsubscribe = null;
  }

  // Use full uncropped image URL
  const fullImageUrl = getFullImageUrl(face.image);
  const dateString = formatFaceDate(face.createdAt);

  dialogBody.innerHTML = `
    <div class="inspect-container">
      <div class="inspect-img-stage" id="inspect-img-stage">
        <div class="inspect-loading" id="inspect-loading">
          <span class="spinner"></span>
          <span style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">Loading full image...</span>
        </div>
        <img
          id="inspect-full-img"
          class="inspect-full-img"
          alt="${escapeHtml(face.name)}"
          style="display: none;"
        >
        <div class="inspect-img-error" id="inspect-error" style="display: none;">
          <span style="display: inline-flex;" aria-hidden="true">${icon('alertTriangle', { size: 24 })}</span>
          <p style="margin: 4px 0 10px; font-size: 13px; color: var(--text-muted);">Unable to load image</p>
          <button type="button" class="btn btn--secondary btn--sm" id="inspect-retry-btn">Retry</button>
        </div>
      </div>
      <div class="inspect-meta">
        <div class="inspect-badges">
          <span class="badge badge-category">${escapeHtml(face.expression || "Funny")}</span>
          <span class="badge badge-score">${icon('star', { size: 11 })} ${escapeHtml(face.funnyScore || "0")} / 10</span>
        </div>
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
          <div class="face-comments-header">
            <h4>Comments (<span id="face-comments-count">0</span>)</h4>
            <span class="face-comments-sub">Everyone can share thoughts!</span>
          </div>

          <div id="face-comments-list" class="face-comments-list">
            <div class="chat-loading-placeholder">
              <span class="spinner"></span>
              <span>Loading comments...</span>
            </div>
          </div>

          <form id="face-comment-form" class="face-comment-form">
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

  // Setup modal Like button state
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

    // Replace onclick cleanly
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
        // Update gallery card if present
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

  // Real-time comments listener for this face
  const commentsListEl = dialogBody.querySelector("#face-comments-list");
  const commentsCountEl = dialogBody.querySelector("#face-comments-count");
  const commentFormEl = dialogBody.querySelector("#face-comment-form");
  const commentInputEl = dialogBody.querySelector("#face-comment-input");

  activeFaceCommentsUnsubscribe = subscribeToFaceComments(
    face.id,
    (comments) => {
      commentsCountEl.textContent = comments.length;
      face.commentsCount = comments.length;

      // Update card comment counter in gallery
      const cardCommentBtn = document.querySelector(`.btn-card-comment[data-face-id="${face.id}"]`);
      if (cardCommentBtn) {
        const numEl = cardCommentBtn.querySelector(".comment-num");
        if (numEl) numEl.textContent = comments.length;
      }

      if (comments.length === 0) {
        commentsListEl.innerHTML = `
          <div style="text-align: center; padding: 20px 8px; color: var(--text-muted); font-size: 12.5px;">
            <p style="margin: 0;">No comments on this face yet.</p>
            <span style="font-size: 11.5px; color: var(--text-subtle);">Be the first to share a thought below!</span>
          </div>
        `;
        return;
      }

      commentsListEl.innerHTML = comments
        .map((c) => `
          <div class="face-comment-item">
            <span class="face-comment-avatar" aria-hidden="true">${renderAvatarSvg(c.avatar, 20)}</span>
            <div class="face-comment-content">
              <div class="face-comment-author-row">
                <span class="face-comment-author">${escapeHtml(c.sender || "Anonymous")}</span>
                <span class="face-comment-time">${formatTimeAgo(c.createdAt)}</span>
              </div>
              <div class="face-comment-text">${formatRichText(c.text)}</div>
            </div>
          </div>
        `)
        .join("");
    },
    (err) => {
      commentsListEl.innerHTML = `<p style="color: var(--danger); font-size: 12px; margin: 0;">Failed to load comments: ${escapeHtml(err.message)}</p>`;
    }
  );

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
    } catch (err) {
      console.error("Posting comment failed:", err);
      showToast("Failed to post comment. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  const imgEl = dialogBody.querySelector("#inspect-full-img");
  const loadingEl = dialogBody.querySelector("#inspect-loading");
  const errorEl = dialogBody.querySelector("#inspect-error");
  const retryBtn = dialogBody.querySelector("#inspect-retry-btn");

  function loadImage(url) {
    loadingEl.style.display = "flex";
    errorEl.style.display = "none";
    imgEl.style.display = "none";

    imgEl.onload = () => {
      loadingEl.style.display = "none";
      errorEl.style.display = "none";
      imgEl.style.display = "block";
    };

    imgEl.onerror = () => {
      loadingEl.style.display = "none";
      errorEl.style.display = "flex";
      imgEl.style.display = "none";
    };

    imgEl.src = url;
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      const retryUrl = fullImageUrl.includes("?")
        ? `${fullImageUrl}&_r=${Date.now()}`
        : `${fullImageUrl}?_r=${Date.now()}`;
      loadImage(retryUrl);
    });
  }

  loadImage(fullImageUrl);

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
  detailsDialog.close();
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

    // Show existing image in preview
    if (face.image) {
      imagePreview.src = face.image;
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
}

function closeFormModal() {
  faceFormDialog.close();
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
  deleteConfirmDialog.close();
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
}

function closeBulkModal() {
  bulkUploadDialog.close();
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
  if (adminLoginDialog) adminLoginDialog.close();
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

// Render message cards in live chat feed
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

  const isScrolledToBottom = (
    chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop <= chatMessagesContainer.clientHeight + 60
  );

  chatMessagesContainer.innerHTML = messages
    .map((msg) => {
      const isMyMsg = msg.sender === currentUser.name;
      const isLiked = isMessageLiked(msg.id);
      const likesCount = typeof msg.likes === "number" ? msg.likes : 0;
      const timeStr = formatTimeAgo(msg.createdAt);

      const faceTag = msg.faceName
        ? `<button type="button" class="chat-msg-tag btn-inspect-tagged-face" data-face-id="${escapeHtml(msg.faceId || '')}" title="Inspect ${escapeHtml(msg.faceName)}">${icon("tag", { size: 11 })} ${escapeHtml(msg.faceName)}</button>`
        : "";

      return `
        <div class="chat-msg ${isMyMsg ? 'my-msg' : ''}" data-msg-id="${escapeHtml(msg.id)}">
          <div class="chat-avatar" aria-hidden="true">${renderAvatarSvg(msg.avatar, 18)}</div>
          <div class="chat-msg-body">
            <div class="chat-msg-header">
              <span class="chat-msg-author">${escapeHtml(msg.sender || "Anonymous")}${isMyMsg ? ' (You)' : ''}</span>
              <span class="chat-msg-time">${timeStr}</span>
            </div>
            ${faceTag}
            <div class="chat-msg-text">${formatRichText(msg.text)}</div>
            <div class="chat-msg-footer">
              <button type="button" class="chat-like-btn ${isLiked ? 'liked' : ''}" data-msg-id="${escapeHtml(msg.id)}" title="${isLiked ? 'Unlike' : 'Like'} this comment">
                <span class="chat-like-heart" aria-hidden="true">${isLiked ? icon('heartFilled', { size: 12 }) : icon('heartOutline', { size: 12 })}</span>
                <span class="chat-like-count">${likesCount}</span>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach click handlers to any tagged face chips
  chatMessagesContainer.querySelectorAll(".btn-inspect-tagged-face").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-face-id");
      const matchedFace = allFaces.find((f) => f.id === targetId);
      if (matchedFace) {
        openDetails(matchedFace);
      }
    });
  });

  // Auto-scroll to bottom if appropriate
  if (!hasInitialChatLoaded || isScrolledToBottom) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
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
  chatInput.focus();

  try {
    await sendChatMessage({ text });
    // Smooth scroll to bottom
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  } catch (err) {
    console.error("Sending chat message failed:", err);
    showToast("Failed to send message. Please try again.", "error");
  }
}

// Mobile Chat Drawer Controls
function openMobileChat() {
  if (liveChatPanel) {
    liveChatPanel.classList.add("mobile-open");
  }
  if (chatBackdrop) {
    chatBackdrop.style.display = "block";
  }
  isMobileChatOpen = true;
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  }, 100);
}

function closeMobileChat() {
  if (liveChatPanel) {
    liveChatPanel.classList.remove("mobile-open");
  }
  if (chatBackdrop) {
    chatBackdrop.style.display = "none";
  }
  isMobileChatOpen = false;
  document.body.style.overflow = "";
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

  nicknameDialog.showModal();
}

function closeNicknameModal() {
  if (nicknameDialog) nicknameDialog.close();
}

function handleNicknameSubmit(e) {
  e.preventDefault();
  const name = (nicknameInput.value || "").trim();
  if (!name) return;

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

// Register all Event Listeners
function setupEventListeners() {
  addFaceBtn.addEventListener("click", () => openFormModal("create"));
  emptyAddBtn.addEventListener("click", () => openFormModal("create"));

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
        chatInput.value = (chatInput.value ? chatInput.value + " " : "") + reaction;
        chatInput.focus();
      }
    });
  });

  // Chat message like click (event delegation)
  if (chatMessagesContainer) {
    chatMessagesContainer.addEventListener("click", async (e) => {
      const likeBtn = e.target.closest(".chat-like-btn");
      if (!likeBtn) return;
      const msgId = likeBtn.getAttribute("data-msg-id");
      if (!msgId) return;

      try {
        const newlyLiked = await toggleMessageLike(msgId);
        const heartEl = likeBtn.querySelector(".chat-like-heart");
        const countEl = likeBtn.querySelector(".chat-like-count");
        let count = parseInt(countEl.textContent, 10) || 0;
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
  [detailsDialog, faceFormDialog, deleteConfirmDialog, bulkUploadDialog, adminLoginDialog, nicknameDialog].forEach((dialog) => {
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
        } else {
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

  subscribeToFaces(
    (faces) => {
      allFaces = faces;
      loadingState.style.display = "none";
      filterFaces();
    },
    (err) => {
      loadingState.style.display = "none";
      facesCounter.textContent = "Failed to load faces";
      showToast(`Firestore error: ${err.message}`, "error");
    }
  );
}

// Start
initApp();

