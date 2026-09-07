(function () {
  // ---------- Tabs ----------
  const tabButtons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // ---------- Slideshow ----------
  const container = document.getElementById("slideshow-container");
  const images = (typeof galleryImages !== "undefined" ? galleryImages : []).slice();

  if (images.length === 0) {
    container.innerHTML = '<p class="gallery-empty">Photos will appear here once added to the images folder.</p>';
    return;
  }

  const slideshow = document.createElement("div");
  slideshow.className = "slideshow";

  const track = document.createElement("div");
  track.className = "slideshow-track";
  images.forEach((filename, i) => {
    const slide = document.createElement("div");
    slide.className = "slide" + (i === 0 ? " active" : "");
    const img = document.createElement("img");
    img.src = "images/" + filename;
    img.alt = "Photo of Teresa Lynn Melton";
    img.loading = i === 0 ? "eager" : "lazy";
    slide.appendChild(img);
    track.appendChild(slide);
  });
  slideshow.appendChild(track);

  if (images.length > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.className = "slideshow-arrow prev";
    prevBtn.setAttribute("aria-label", "Previous photo");
    prevBtn.textContent = "‹";

    const nextBtn = document.createElement("button");
    nextBtn.className = "slideshow-arrow next";
    nextBtn.setAttribute("aria-label", "Next photo");
    nextBtn.textContent = "›";

    slideshow.appendChild(prevBtn);
    slideshow.appendChild(nextBtn);
  }

  container.appendChild(slideshow);

  const dotsWrap = document.createElement("div");
  dotsWrap.className = "slideshow-dots";
  if (images.length > 1) {
    images.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.setAttribute("aria-label", "Go to photo " + (i + 1));
      dotsWrap.appendChild(dot);
    });
    container.appendChild(dotsWrap);
  }

  const slides = track.querySelectorAll(".slide");
  const dots = dotsWrap.querySelectorAll(".dot");
  let current = 0;
  let timer = null;
  const INTERVAL = 9000;

  function goTo(index) {
    slides[current].classList.remove("active");
    if (dots[current]) dots[current].classList.remove("active");
    current = (index + images.length) % images.length;
    slides[current].classList.add("active");
    if (dots[current]) dots[current].classList.add("active");
    renderComments();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function writingComment() {
    const body = document.getElementById("comments-body");
    return body && !body.hidden;
  }

  function startAutoplay() {
    if (images.length > 1 && !timer && !writingComment()) timer = setInterval(next, INTERVAL);
  }
  function stopAutoplay() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function restartAutoplay() { stopAutoplay(); startAutoplay(); }

  const prevBtnEl = slideshow.querySelector(".prev");
  const nextBtnEl = slideshow.querySelector(".next");
  if (prevBtnEl) prevBtnEl.addEventListener("click", () => { prev(); restartAutoplay(); });
  if (nextBtnEl) nextBtnEl.addEventListener("click", () => { next(); restartAutoplay(); });
  dots.forEach((dot, i) => dot.addEventListener("click", () => { goTo(i); restartAutoplay(); }));

  slideshow.addEventListener("mouseenter", stopAutoplay);
  slideshow.addEventListener("mouseleave", startAutoplay);
  startAutoplay();

  // ---------- Comments (per photo, stored via /api/comments) ----------
  const commentsEl = document.getElementById("comments");
  const listEl = document.getElementById("comments-list");
  const statusEl = document.getElementById("comments-status");
  const formEl = document.getElementById("comment-form");
  const nameEl = document.getElementById("comment-name");
  const messageEl = document.getElementById("comment-message");
  const submitEl = formEl.querySelector(".comment-submit");
  const toggleEl = document.getElementById("comment-toggle");
  const bodyEl = document.getElementById("comments-body");
  const countEl = document.getElementById("comment-count");

  function setOpen(open) {
    bodyEl.hidden = !open;
    toggleEl.setAttribute("aria-expanded", String(open));
    toggleEl.classList.toggle("open", open);
    if (open) stopAutoplay();
    else startAutoplay();
  }

  toggleEl.addEventListener("click", () => {
    setStatus("");
    setOpen(bodyEl.hidden);
  });

  let allComments = [];
  let commentsAvailable = false;

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.className = "comments-status" + (kind ? " " + kind : "");
    statusEl.hidden = !text;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function renderComments() {
    if (!commentsAvailable) return;
    const photo = images[current];
    const mine = allComments.filter((c) => c.photo === photo);
    countEl.textContent = String(mine.length);
    countEl.hidden = mine.length === 0;
    listEl.innerHTML = "";
    if (mine.length === 0) {
      const li = document.createElement("li");
      li.className = "comment-empty";
      li.textContent = "If this photo brings back a memory, we would love for you to share it.";
      listEl.appendChild(li);
      return;
    }
    mine.forEach((c) => {
      const li = document.createElement("li");
      li.className = "comment";
      const head = document.createElement("div");
      head.className = "comment-head";
      const who = document.createElement("span");
      who.className = "comment-name";
      who.textContent = c.name;
      const when = document.createElement("span");
      when.className = "comment-date";
      when.textContent = formatDate(c.date);
      head.appendChild(who);
      head.appendChild(when);
      const body = document.createElement("p");
      body.className = "comment-message";
      body.textContent = c.message;
      li.appendChild(head);
      li.appendChild(body);
      listEl.appendChild(li);
    });
  }

  async function loadComments(initial) {
    try {
      const res = await fetch("/api/comments", { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      const data = await res.json();
      allComments = Array.isArray(data.comments) ? data.comments : [];
      commentsAvailable = true;
      commentsEl.hidden = false;
      renderComments();
    } catch (err) {
      // No API here (opened as a local file, or not deployed yet) — keep the gallery clean.
      // A failed background refresh just keeps what we already have.
      if (initial) {
        commentsAvailable = false;
        commentsEl.hidden = true;
      }
    }
  }

  // Pick up memories other visitors post while this page is open.
  const REFRESH_MS = 90 * 1000;
  setInterval(() => {
    if (commentsAvailable && bodyEl.hidden) loadComments(false);
  }, REFRESH_MS);

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      photo: images[current],
      name: nameEl.value.trim(),
      message: messageEl.value.trim(),
      website: formEl.elements.website.value,
    };
    if (!payload.name || !payload.message) {
      setStatus("Please add your name and a message.", "error");
      return;
    }
    submitEl.disabled = true;
    setStatus("Posting…");
    stopAutoplay();
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not post your memory.");
      if (data.comment) allComments.push(data.comment);
      messageEl.value = "";
      renderComments();
      setStatus("Thank you — your memory has been shared.", "success");
    } catch (err) {
      setStatus(err.message || "Could not post your memory.", "error");
    } finally {
      submitEl.disabled = false;
    }
  });

  loadComments(true);

  // ---------- Teri's song (YouTube player + header sound toggle) ----------
  // Browsers block sound until the visitor taps something, so the page loads
  // silent and the speaker icon starts the music. The visible player lives in
  // the Tributes section; the icon drives it remotely.
  const songHost = document.getElementById("song-player");
  const soundBtn = document.getElementById("sound-toggle");
  const videoId = songHost && songHost.dataset.videoId;

  if (songHost && soundBtn && videoId) {
    let player = null;
    let playerReady = false;
    let pendingPlay = false;

    function soundIsOn() {
      return playerReady && !player.isMuted() && player.getPlayerState() === YT.PlayerState.PLAYING;
    }

    function updateSoundIcon() {
      const on = soundIsOn();
      soundBtn.classList.toggle("on", on);
      soundBtn.setAttribute("aria-pressed", String(on));
      const label = on ? "Mute Teri's song" : "Play Teri's song";
      soundBtn.setAttribute("aria-label", label);
      soundBtn.title = label;
    }

    function startSound() {
      player.unMute();
      player.setVolume(65);
      player.playVideo();
      updateSoundIcon();
    }

    window.onYouTubeIframeAPIReady = function () {
      player = new YT.Player("song-player", {
        videoId,
        playerVars: { playsinline: 1, rel: 0, loop: 1, playlist: videoId, modestbranding: 1 },
        events: {
          onReady() {
            playerReady = true;
            if (pendingPlay) { pendingPlay = false; startSound(); }
            updateSoundIcon();
          },
          onStateChange() { updateSoundIcon(); },
        },
      });
    };

    const api = document.createElement("script");
    api.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(api);

    soundBtn.addEventListener("click", () => {
      dismissPrompt();
      if (!playerReady) { pendingPlay = true; return; }
      if (soundIsOn()) {
        player.mute();
        updateSoundIcon();
      } else {
        startSound();
      }
    });

    // An invitation to start the music, pointing at the speaker icon. It shows
    // on every visit — people forget the song is there — but folds away on its
    // own and can be dismissed with the ×.
    const promptEl = document.getElementById("sound-prompt");
    const promptPlay = document.getElementById("sound-prompt-play");
    const promptClose = document.getElementById("sound-prompt-close");
    let promptTimer = null;

    function dismissPrompt() {
      if (!promptEl || promptEl.hidden || promptEl.classList.contains("leaving")) return;
      clearTimeout(promptTimer);
      promptEl.classList.add("leaving");
      setTimeout(() => {
        promptEl.hidden = true;
        promptEl.classList.remove("leaving");
      }, 300);
    }

    if (promptEl) {
      setTimeout(() => {
        if (!soundIsOn()) {
          promptEl.hidden = false;
          promptTimer = setTimeout(dismissPrompt, 15000);
        }
      }, 1200);

      promptPlay.addEventListener("click", () => {
        dismissPrompt();
        if (!playerReady) { pendingPlay = true; return; }
        if (!soundIsOn()) startSound();
      });

      promptClose.addEventListener("click", dismissPrompt);
    }
  }
})();
