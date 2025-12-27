// === Azure Logic App endpoints & storage account ===
const UIA =
  "https://prod-02.norwayeast.logic.azure.com:443/workflows/08f68c73d43b4d3c954f126c53963e4d/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=1y8trRu4pq9BCjbc5hVv73K9MXjXPZKctOfnQwjooK4";

const RAI =
  "https://prod-09.norwayeast.logic.azure.com:443/workflows/d91235d116d14d14bb5eb0ba0290e87d/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=hxr7e2g2gwBfdTi2rHIHMCbt8kldNHi0gA1qInOIV2k";

const BLOB_ACCOUNT = "https://sujitstorage.blob.core.windows.net";

$(document).ready(function () {
  $("#retImages").on("click", getImages);
  $("#subNewForm").on("click", submitNewAsset);

  console.log("✅ app.js loaded and click handlers attached");
});

// === Upload new asset ===
function submitNewAsset() {
  const fileObj = $("#UpFile")[0].files[0];
  if (!fileObj) {
    alert("Please choose a file first.");
    return;
  }

  const submitData = new FormData();
  submitData.append("FileName", $("#FileName").val());
  submitData.append("userID", $("#userID").val());
  submitData.append("userName", $("#userName").val());
  submitData.append("file", fileObj);

  $.ajax({
    url: UIA,
    data: submitData,
    cache: false,
    enctype: "multipart/form-data",
    contentType: false,
    processData: false,
    type: "POST",
    success: (data) => {
      console.log("Upload response:", data);
      alert("Uploaded successfully!");
    },
    error: (xhr, status, err) => {
      console.error("Upload failed:", status, err, xhr?.responseText);
      alert("Upload failed — see console for details.");
    },
  });
}

// === Retrieve and render media list ===
function getImages() {
  const $list = $("#ImageList");

  $list
    .addClass("media-grid")
    .html(
      '<div class="spinner-border" role="status" aria-label="Loading"></div>'
    );

  $.ajax({
    url: RAI,
    type: "Post",
    dataType: "json",
    success: function (data) {
      console.log("Raw data received:", data);

      // Sometimes Logic Apps returns { body: [...] }
      if (!Array.isArray(data) && data && Array.isArray(data.body)) {
        data = data.body;
      }

      if (!Array.isArray(data)) {
        $list.html("<p>No media found or invalid data format.</p>");
        return;
      }

      let videoCounter = 0;
      const cards = [];

      $.each(data, function (_, val) {
        try {
          let fileName = unwrapMaybeBase64(val.fileName || val.FileName || "");
          let filePath = unwrapMaybeBase64(val.filePath || val.FilePath || "");
          let userName = unwrapMaybeBase64(val.userName || val.UserName || "");
          let userID = unwrapMaybeBase64(val.userID || val.UserID || "");
          const contentType = val.contentType || val.ContentType || "";

          const fullUrl = buildBlobUrl(filePath);
          const isVideo = isLikelyVideo({ contentType, url: fullUrl, fileName });

          if (isVideo) {
            videoCounter += 1;
            const label = `video${videoCounter}`;

            cards.push(`
              <div class="media-card">
                <div class="media-thumb">
                  <a class="video-link" href="${fullUrl}" target="_blank" rel="noopener">${label}</a>
                </div>
                <div class="media-body">
                  <span class="media-title">${escapeHtml(fileName || "(unnamed)")}</span>
                  <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                </div>
              </div>
            `);
          } else {
            const safeLabel = escapeHtml(fileName || fullUrl);

            cards.push(`
              <div class="media-card">
                <div class="media-thumb">
                  <img
                    src="${fullUrl}"
                    alt="${safeLabel}"
                    onerror="imageFallbackToLink(this, '${fullUrl.replace(/'/g, "\\'")}', '${safeLabel.replace(/'/g, "\\'")}')"
                  />
                </div>
                <div class="media-body">
                  <span class="media-title">${safeLabel}</span>
                  <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                  <div class="image-error"></div>
                </div>
              </div>
            `);
          }
        } catch (err) {
          console.error("Error building card:", err, val);
          cards.push(`
            <div class="media-card">
              <div class="media-body">
                <span class="media-title" style="color:#b91c1c;">Error displaying this item</span>
              </div>
            </div>
          `);
        }
      });

      $list.html(cards.join(""));
    },
    error: (xhr, status, error) => {
      console.error("Error fetching media:", status, error, xhr?.responseText);
      $list.html("<p style='color:red;'>Error loading media. Check console.</p>");
    },
  });
}

// === Helpers ===
function unwrapMaybeBase64(value) {
  if (value && typeof value === "object" && "$content" in value) {
    try {
      return atob(value.$content);
    } catch {
      return value.$content || "";
    }
  }
  return value || "";
}

function buildBlobUrl(filePath) {
  if (!filePath) return "";
  const trimmed = String(filePath).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const left = (BLOB_ACCOUNT || "").replace(/\/+$/g, "");
  const right = trimmed.replace(/^\/+/g, "");
  return `${left}/${right}`;
}

function isLikelyVideo({ contentType, url, fileName }) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;

  const target = ((url || "") + " " + (fileName || "")).toLowerCase();
  return /\.(mp4|m4v|webm|og[gv]|mov|avi)(\?|#|$)/.test(target);
}

function imageFallbackToLink(imgEl, url, label) {
  const card = imgEl.closest(".media-card");
  if (!card) return;

  const thumb = card.querySelector(".media-thumb");
  const errMsg = card.querySelector(".image-error");

  if (thumb) {
    thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="video-link">${label || url}</a>`;
  }
  if (errMsg) {
    errMsg.textContent = "Image failed to load — shown as link instead.";
    errMsg.style.display = "block";
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
