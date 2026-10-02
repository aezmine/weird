// Cloudinary Direct Unsigned Upload Service
import { cloudinaryConfig } from "../firebase-config.js";

/**
 * Uploads an image file directly to Cloudinary using an unsigned upload preset.
 * @param {File} file - The file to upload
 * @returns {Promise<string>} The secure HTTPS URL of the uploaded image
 */
export async function uploadToCloudinary(file) {
  if (!cloudinaryConfig.cloudName || cloudinaryConfig.cloudName === "YOUR_CLOUD_NAME") {
    throw new Error(
      "Cloudinary Cloud Name is not configured yet! Please update 'cloudName' in firebase-config.js."
    );
  }

  if (!cloudinaryConfig.uploadPreset || cloudinaryConfig.uploadPreset === "YOUR_UPLOAD_PRESET") {
    throw new Error(
      "Cloudinary Upload Preset is missing! Please create an Unsigned Upload Preset in Cloudinary and set it in firebase-config.js."
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
  
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || "Failed to upload image to Cloudinary.";
      throw new Error(errorMsg);
    }

    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    throw error;
  }
}

/**
 * Uploads multiple image files to Cloudinary with progress tracking.
 * @param {Array<File>} files - The list of image files to upload
 * @param {Function} onProgress - Callback with { current, total, percent, fileName }
 * @returns {Promise<Array<{ file: File, secureUrl: string }>>}
 */
export async function uploadMultipleToCloudinary(files, onProgress) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        percent: Math.round((i / total) * 100),
        fileName: file.name
      });
    }

    const secureUrl = await uploadToCloudinary(file);
    results.push({ file, secureUrl });

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        fileName: file.name
      });
    }
  }

  return results;
}

/**
 * Splits a Cloudinary URL into its base prefix and asset path,
 * cleanly removing any existing dynamic transformation segments.
 * @param {string} url
 * @returns {{ prefix: string, assetPath: string } | null}
 */
export function cleanCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return null;
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1 || !url.includes("res.cloudinary.com")) return null;

  const prefix = url.slice(0, idx + marker.length);
  const rest = url.slice(idx + marker.length);
  const segments = rest.split("/");
  const assetSegments = [];
  let foundAsset = false;

  for (const seg of segments) {
    if (!foundAsset) {
      // Cloudinary version tag looks like v123456789.
      // Transformation segments contain parameter tags like c_fill, w_400, f_auto, q_auto:eco.
      if (/^v\d+$/.test(seg) || !/^[a-z]{1,4}_[a-z0-9_:\.-]+(?:,[a-z]{1,4}_[a-z0-9_:\.-]+)*$/i.test(seg)) {
        foundAsset = true;
        assetSegments.push(seg);
      }
    } else {
      assetSegments.push(seg);
    }
  }

  return {
    prefix,
    assetPath: assetSegments.length > 0 ? assetSegments.join("/") : rest
  };
}

/**
 * Generates an ultra-lightweight optimized image URL for initial previews, cards, and thumbnails.
 * Shrinks heavy multi-megabyte images to fast, compressed (~20KB-40KB) previews to eliminate page lag.
 * @param {string} url - The original image URL
 * @param {Object} [options] - Transformation options { width, height, fit, quality, gravity }
 * @returns {string} Optimized preview image URL
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url || typeof url !== "string") return "";

  const {
    width = 440,
    height = 330,
    fit = "fill",
    quality = "auto:eco",
    gravity = "auto"
  } = options;

  // Cloudinary URL transformation
  const parsed = cleanCloudinaryUrl(url);
  if (parsed) {
    const transformParts = [
      "f_auto",
      `q_${quality}`,
      `c_${fit}`,
      ...(fit === "fill" || fit === "crop" || fit === "thumb" ? [`g_${gravity}`] : []),
      `w_${width}`,
      ...(height ? [`h_${height}`] : [])
    ];
    return `${parsed.prefix}${transformParts.join(",")}/${parsed.assetPath}`;
  }

  // Unsplash URL optimization
  if (url.includes("images.unsplash.com")) {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set("w", String(width));
      if (height) parsedUrl.searchParams.set("h", String(height));
      parsedUrl.searchParams.set("auto", "format");
      parsedUrl.searchParams.set("fit", "crop");
      parsedUrl.searchParams.set("q", "70");
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }

  return url;
}

/**
 * Returns the unconstrained, original real-size image URL for the Inspect modal or full-screen view.
 * Strips all cropping, height, and width constraints so the real full-resolution picture is delivered.
 * @param {string} url - The original image URL
 * @returns {string} Full real-size image URL
 */
export function getFullImageUrl(url) {
  if (!url || typeof url !== "string") return "";

  // Cloudinary: deliver original real size with smart browser format & high quality, NO cropping or resizing
  const parsed = cleanCloudinaryUrl(url);
  if (parsed) {
    return `${parsed.prefix}f_auto,q_auto/${parsed.assetPath}`;
  }

  // Unsplash: remove crop & fixed dimensions to preserve natural aspect ratio and full resolution
  if (url.includes("images.unsplash.com")) {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.delete("fit");
      parsedUrl.searchParams.delete("crop");
      parsedUrl.searchParams.delete("w");
      parsedUrl.searchParams.delete("h");
      parsedUrl.searchParams.set("auto", "format");
      parsedUrl.searchParams.set("q", "90");
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }

  return url;
}

