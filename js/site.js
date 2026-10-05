const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

const story = document.querySelector(".story");
const sheet = document.querySelector(".sheet");
const video = document.querySelector(".flight-media video");
const beats = [...document.querySelectorAll(".beat")];
const rails = [...document.querySelectorAll("[data-rail]")];
const hint = document.querySelector(".hint");
const progress = document.querySelector(".flight-progress span");
const beatLabel = document.querySelector("[data-beat-label]");
const nav = document.querySelector(".nav");
const haze = document.querySelector(".haze");

const WINDOWS = [
  [0.0, 0.0, 0.16, 0.24],
  [0.21, 0.29, 0.42, 0.5],
  [0.47, 0.55, 0.66, 0.74],
  [0.71, 0.78, 0.84, 0.9],
];

const LABELS = ["A promessa", "A janela", "O ritmo", "A cidade"];

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function smooth(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function fade(p, a, b, c, d) {
  if (p < a || p > d) return 0;
  if (p < b) return b === a ? 1 : smooth((p - a) / (b - a));
  if (p > c) return d === c ? 0 : 1 - smooth((p - c) / (d - c));
  return 1;
}

function flightProgress() {
  const vh = window.innerHeight;
  const range = Math.max(story.offsetHeight - vh, 1);
  return clamp((window.scrollY - story.offsetTop) / range, 0, 1);
}

function paintBeat(beat, p, win) {
  const o = fade(p, win[0], win[1], win[2], win[3]);
  let y = 0;
  if (p < win[1]) y = (1 - o) * 28;
  else if (p > win[2]) y = (1 - o) * -22;
  beat.style.opacity = String(o);
  beat.style.transform = `translate3d(0, ${y}px, 0)`;
  const on = o > 0.45;
  beat.toggleAttribute("inert", !on);
  beat.setAttribute("aria-hidden", on ? "false" : "true");
  return o;
}

function updateFlight() {
  if (reduced.matches) return;
  const p = flightProgress();
  let lead = 0;
  let leadOpacity = -1;
  beats.forEach((beat, i) => {
    const o = paintBeat(beat, p, WINDOWS[i]);
    if (o > leadOpacity) {
      leadOpacity = o;
      lead = i;
    }
  });

  rails.forEach((rail, i) => {
    rail.classList.toggle("is-on", i === lead && leadOpacity > 0.35);
  });
  if (beatLabel) beatLabel.textContent = LABELS[lead];
  if (hint) hint.style.opacity = String(clamp(1 - p * 10, 0, 1));
  if (progress) progress.style.transform = `scaleX(${clamp(p / 0.82, 0, 1)})`;

  const sheetTop = sheet.getBoundingClientRect().top;
  nav.classList.toggle("is-paper", sheetTop < 78);

  if (haze) haze.style.transform = `translate3d(0, ${p * -48}px, 0)`;
  if (video) video.style.transform = `scale(${1.2 + p * 0.08})`;

  document.querySelectorAll("[data-parallax-speed]").forEach((el) => {
    const rect = el.getBoundingClientRect();
    const delta = rect.top + rect.height / 2 - window.innerHeight / 2;
    const speed = Number(el.dataset.parallaxSpeed) || 0;
    el.style.setProperty("--py", `${delta * speed * -0.15}px`);
  });

  if (video && Number.isFinite(video.duration)) {
    requestSeek(clamp(p / 0.8, 0, 1) * video.duration);
  }
}

let ticking = false;
function requestFlight() {
  if (ticking || reduced.matches) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateFlight();
    ticking = false;
  });
}

let seeking = false;
let wantTime = 0;

function buffered(time) {
  if (!video) return false;
  const ranges = video.buffered;
  for (let i = 0; i < ranges.length; i += 1) {
    if (time >= ranges.start(i) && time <= ranges.end(i) - 0.04) return true;
  }
  return false;
}

function requestSeek(time) {
  wantTime = time;
  if (!video || seeking || !buffered(time)) return;
  if (Math.abs(video.currentTime - time) < 0.05) return;
  seeking = true;
  try {
    video.currentTime = time;
  } catch {
    seeking = false;
  }
}

function initFlight() {
  if (!video) return;
  if (reduced.matches) {
    beats.forEach((beat) => {
      beat.removeAttribute("inert");
      beat.removeAttribute("aria-hidden");
    });
    return;
  }
  video.pause();
  video.addEventListener("seeked", () => {
    seeking = false;
    if (Math.abs(video.currentTime - wantTime) > 0.05) requestSeek(wantTime);
  });
  window.addEventListener("scroll", requestFlight, { passive: true });
  window.addEventListener("resize", requestFlight);
  video.addEventListener("loadeddata", requestFlight, { once: true });
  updateFlight();
}

rails.forEach((rail) => {
  rail.addEventListener("click", () => {
    const i = Number(rail.dataset.rail);
    const win = WINDOWS[i];
    const p = (win[1] + win[2]) / 2;
    const range = Math.max(story.offsetHeight - window.innerHeight, 1);
    window.scrollTo({
      top: story.offsetTop + p * range,
      behavior: reduced.matches ? "auto" : "smooth",
    });
  });
});

function initNav() {
  const toggle = document.querySelector(".nav__toggle");
  const panel = document.querySelector(".nav__links");
  if (!toggle || !panel) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  });
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Abrir menu");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function initBook() {
  const dialog = document.querySelector("#agendar");
  const form = dialog.querySelector("form");
  const ok = dialog.querySelector(".book__ok");
  const error = dialog.querySelector(".book__error");
  const viagem = form.elements.viagem;
  const today = new Date().toISOString().slice(0, 10);
  form.elements.chegada.min = today;
  form.elements.partida.min = today;

  function open(tour) {
    if (tour) viagem.value = tour;
    if (!dialog.open) dialog.showModal();
  }

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-open-book]");
    if (!btn) return;
    open(btn.dataset.tour || "");
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    form.hidden = false;
    ok.hidden = true;
    error.textContent = "";
    form.reset();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const chegada = form.elements.chegada.value;
    const partida = form.elements.partida.value;
    if (partida && chegada && partida < chegada) {
      error.textContent = "A volta precisa ser depois da chegada.";
      return;
    }
    error.textContent = "";
    form.hidden = true;
    ok.hidden = false;
  });
}

function initFan() {
  const fan = document.querySelector(".fan");
  if (!fan) return;
  const tours = [...fan.querySelectorAll(".tour")];
  const live = document.querySelector("[data-fan-live]");
  let active = 1;

  function render() {
    const n = tours.length;
    tours.forEach((tour, i) => {
      const rel = (i - active + n) % n;
      tour.classList.toggle("is-center", rel === 0);
      tour.classList.toggle("is-right", rel === 1);
      tour.classList.toggle("is-left", rel === 2 % n && rel !== 0 && rel !== 1);
      if (n === 3) {
        tour.classList.toggle("is-left", rel === 2);
        tour.classList.toggle("is-right", rel === 1);
        tour.classList.toggle("is-center", rel === 0);
      }
      tour.setAttribute("aria-current", rel === 0 ? "true" : "false");
    });
    if (live) live.textContent = `${tours[active].dataset.tour} em destaque`;
  }

  function step(dir) {
    const narrow = window.matchMedia("(max-width: 860px)").matches;
    if (narrow) {
      fan.scrollBy({
        left: dir * Math.round(fan.clientWidth * 0.82),
        behavior: reduced.matches ? "auto" : "smooth",
      });
      return;
    }
    const n = tours.length;
    active = (active + dir + n) % n;
    render();
  }

  document.querySelectorAll("[data-fan]").forEach((btn) => {
    btn.addEventListener("click", () => step(Number(btn.dataset.fan)));
  });

  tours.forEach((tour, i) => {
    tour.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      if (window.matchMedia("(max-width: 860px)").matches) return;
      active = i;
      render();
    });
  });

  fan.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") step(1);
    if (event.key === "ArrowLeft") step(-1);
  });

  render();
}

function initReveal() {
  const nodes = document.querySelectorAll("[data-reveal]");
  if (!nodes.length || reduced.matches) {
    nodes.forEach((node) => node.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.22 }
  );
  nodes.forEach((node) => io.observe(node));
}

function initManifesto() {
  const block = document.querySelector(".manifesto");
  const line = block && block.querySelector("[data-split]");
  if (!line || reduced.matches) return;
  const text = line.textContent.trim();
  line.textContent = "";
  let index = 0;
  text.split(" ").forEach((word, wordIndex) => {
    if (wordIndex) line.appendChild(document.createTextNode(" "));
    const wrap = document.createElement("span");
    wrap.className = "word";
    [...word].forEach((char) => {
      const span = document.createElement("span");
      span.className = "char";
      span.style.setProperty("--i", String(index));
      span.textContent = char;
      wrap.appendChild(span);
      index += 1;
    });
    line.appendChild(wrap);
  });
  block.classList.add("is-ready");
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      block.classList.add("is-in");
      io.disconnect();
    },
    { threshold: 0.45 }
  );
  io.observe(block);
}

initNav();
initBook();
initFan();
initReveal();
initManifesto();
initFlight();

reduced.addEventListener("change", () => {
  if (!reduced.matches) return;
  beats.forEach((beat) => {
    beat.style.opacity = "";
    beat.style.transform = "";
    beat.removeAttribute("inert");
    beat.removeAttribute("aria-hidden");
  });
  if (video) video.pause();
  nav.classList.remove("is-paper");
});
