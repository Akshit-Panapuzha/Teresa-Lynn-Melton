(function () {
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
  const INTERVAL = 5000;

  function goTo(index) {
    slides[current].classList.remove("active");
    if (dots[current]) dots[current].classList.remove("active");
    current = (index + images.length) % images.length;
    slides[current].classList.add("active");
    if (dots[current]) dots[current].classList.add("active");
  }

  function next() {
    goTo(current + 1);
  }

  function prev() {
    goTo(current - 1);
  }

  function startAutoplay() {
    if (images.length > 1) {
      timer = setInterval(next, INTERVAL);
    }
  }

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  const prevBtnEl = slideshow.querySelector(".prev");
  const nextBtnEl = slideshow.querySelector(".next");
  if (prevBtnEl) prevBtnEl.addEventListener("click", () => { prev(); restartAutoplay(); });
  if (nextBtnEl) nextBtnEl.addEventListener("click", () => { next(); restartAutoplay(); });

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => { goTo(i); restartAutoplay(); });
  });

  slideshow.addEventListener("mouseenter", stopAutoplay);
  slideshow.addEventListener("mouseleave", startAutoplay);

  startAutoplay();
})();
