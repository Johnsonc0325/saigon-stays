/* ── 圖片點擊放大（lightbox）──
 * 點任何內容區的圖片 → 全螢幕顯示完整圖（object-fit: contain）
 * 關閉：點背景、點 X、按 ESC
 */
(function () {
  "use strict";

  var overlay = null;
  var imgEl = null;
  var captionEl = null;
  var lastFocus = null;

  function build() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "imgLightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "圖片放大檢視");
    overlay.hidden = true;

    var inner = document.createElement("figure");
    inner.className = "imgLightboxInner";

    imgEl = document.createElement("img");
    imgEl.alt = "";
    imgEl.decoding = "async";

    captionEl = document.createElement("figcaption");
    captionEl.className = "imgLightboxCaption";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "imgLightboxClose";
    close.setAttribute("aria-label", "關閉");
    close.innerHTML = "&times;";

    var hint = document.createElement("p");
    hint.className = "imgLightboxHint";
    hint.textContent = "點背景或按 ESC 關閉";

    inner.appendChild(imgEl);
    inner.appendChild(captionEl);
    overlay.appendChild(close);
    overlay.appendChild(inner);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.closest(".imgLightboxClose")) closeBox();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay && !overlay.hidden) closeBox();
    });
  }

  function openBox(img) {
    build();
    lastFocus = document.activeElement;
    imgEl.src = img.currentSrc || img.src;
    imgEl.alt = img.alt || "";
    var cap = img.getAttribute("alt") || "";
    captionEl.textContent = cap;
    captionEl.hidden = !cap;
    overlay.hidden = false;
    document.documentElement.classList.add("imgLightboxOpen");
    var btn = overlay.querySelector(".imgLightboxClose");
    if (btn) btn.focus();
  }

  function closeBox() {
    if (!overlay) return;
    overlay.hidden = true;
    imgEl.src = "";
    document.documentElement.classList.remove("imgLightboxOpen");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  // 判斷哪些圖片可以點（內容區、有意義大小、非 icon）
  function isZoomable(img) {
    if (!img || img.tagName !== "IMG") return false;
    if (img.dataset.noZoom === "true") return false;
    var cls = (img.className || "") + " " + (img.parentElement ? img.parentElement.className : "");
    if (/logo|icon|avatar|emoji/i.test(cls)) return false;
    var r = img.getBoundingClientRect();
    if (r.width < 72 || r.height < 48) return false;
    var src = img.currentSrc || img.src || "";
    if (!src || src.indexOf("data:image/svg") === 0) return false;
    return true;
  }

  document.addEventListener("click", function (e) {
    var img = e.target.closest("img");
    if (!img || !isZoomable(img)) return;
    // 如果圖片被 <a> 包住（例如連到別的頁），點圖片還是放大，不跳頁
    var a = img.closest("a");
    if (a && a.getAttribute("href") && !/\.(jpg|jpeg|png|webp|gif)$/i.test(a.getAttribute("href"))) {
      e.preventDefault();
    }
    e.stopPropagation();
    openBox(img);
  }, true);

  // 標記可點游標
  function markCursor() {
    var imgs = document.querySelectorAll("main img, article img, figure img, .detail img");
    for (var i = 0; i < imgs.length; i++) {
      if (isZoomable(imgs[i])) {
        imgs[i].classList.add("zoomableImg");
        imgs[i].setAttribute("title", "點擊看完整圖片");
      }
    }
  }

  // lazy 載入的圖片：用 IntersectionObserver 動態標記（否則 scroll 後才載入的圖沒有放大鏡）
  function observeLazy() {
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var en = entries[i];
        if (!en.isIntersecting) continue;
        var im = en.target;
        if (im.complete && isZoomable(im)) {
          im.classList.add("zoomableImg");
          im.setAttribute("title", "點擊看完整圖片");
          io.unobserve(im);
        }
      }
    }, { rootMargin: "300px 0px" });
    var all = document.querySelectorAll("main img, article img, figure img, .detail img");
    for (var j = 0; j < all.length; j++) {
      if (!all[j].classList.contains("zoomableImg")) io.observe(all[j]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { markCursor(); observeLazy(); });
  } else {
    markCursor();
    observeLazy();
  }
  // 動態載入的圖片（例如清單渲染）也標記
  window.addEventListener("load", function () { setTimeout(function () { markCursor(); observeLazy(); }, 600); });
})();
