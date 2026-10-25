/*! Carlsson & Co. site motion (Lumora design, Oct 2026). Plain JS, progressive enhancement only:
 * every word, price and buy link is in the HTML and works without this file.
 * Uses Lenis (MIT, darkroom.engineering), self-hosted as motion/lenis.min.js.
 * Liquid cursor reveal, loader, reveals and count-up follow the Lumora spec (see marketing/redesign/lumora-spec.md). */
(function () {
  "use strict";
  var w = window, d = document, h = d.documentElement;
  h.classList.add("lumora");
  var reduce = w.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- adaptive grid: keep growing above 1920px (media queries handle the rest) ---------- */
  function applyAdaptiveGrid() {
    var FONT_BASE = 16, baseWidth = 1920, coef = 0.6666, vw = w.innerWidth;
    var widthReduction = ((baseWidth - vw) / baseWidth) * 100;
    var size = FONT_BASE - (FONT_BASE * (widthReduction * coef)) / 100;
    if (size > FONT_BASE) h.style.fontSize = size + "px"; else h.style.removeProperty("font-size");
  }
  applyAdaptiveGrid();
  w.addEventListener("resize", applyAdaptiveGrid);

  /* ---------- Lenis + scroll lock ---------- */
  var lenis = null;
  if (!reduce && w.Lenis) {
    lenis = new w.Lenis({ smoothWheel: true });
    var raf = function (t) { lenis.raf(t); w.requestAnimationFrame(raf); };
    w.requestAnimationFrame(raf);
  }
  var locks = 0;
  function stopScroll() {
    locks += 1;
    if (lenis) lenis.stop();
    h.style.position = "relative"; h.style.overflow = "hidden";
  }
  function startScroll() {
    locks = Math.max(0, locks - 1);
    if (locks) return;
    if (lenis) lenis.start();
    h.style.removeProperty("position"); h.style.removeProperty("overflow");
  }
  function scrollToEl(el) {
    if (lenis) lenis.scrollTo(el, { offset: -16, duration: 1.2 });
    else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }
  // same-page anchors (#library, #sets, #faq ...)
  d.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href*='#']");
    if (!a || a.classList.contains("skip") || a.hasAttribute("data-menu") || a.hasAttribute("data-menu-close")) return;
    var url = new URL(a.href, w.location.href);
    if (url.pathname !== w.location.pathname || url.host !== w.location.host || !url.hash) return;
    var el = d.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    if (d.querySelector(".nm.open")) closeMenu(true);
    scrollToEl(el);
    if (w.history.pushState) w.history.pushState(null, "", url.hash);
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  });
  var pv = d.getElementById("pv");
  if (pv && w.MutationObserver) {
    new MutationObserver(function () { pv.open ? stopScroll() : startScroll(); })
      .observe(pv, { attributes: true, attributeFilter: ["open"] });
  }

  /* ---------- reveals ---------- */
  var heroEls = [].slice.call(d.querySelectorAll(".hero .rv, .hero .lr"));
  var revealEls = [].slice.call(d.querySelectorAll(".rv, .lr, .wr")).filter(function (el) { return heroEls.indexOf(el) < 0; });
  if ("IntersectionObserver" in w && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }
  function ready() {
    h.classList.add("is-ready");
    heroEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- intro loader (home only, once per visit) ---------- */
  var loader = d.querySelector(".loader");
  if (loader && h.classList.contains("intro") && !reduce) {
    w.scrollTo(0, 0);
    stopScroll();
    var fill = loader.querySelector(".loader-fill"), num = loader.querySelector(".loader-n");
    /* kept short: the finder is the first thing on the page and should not wait behind the loader */
    var FILL_MS = 450, t0 = null;
    var step = function (now) {
      if (t0 === null) t0 = now;
      var t = Math.min(1, (now - t0) / FILL_MS);
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      var p = Math.round(e * 100);
      fill.style.width = p + "%";
      num.textContent = ("00" + p).slice(-3);
      if (t < 1) { w.requestAnimationFrame(step); return; }
      loader.classList.add("out");
      ready();
      w.setTimeout(function () {
        loader.remove(); h.classList.remove("intro"); startScroll();
      }, 450);
    };
    w.requestAnimationFrame(step);
  } else {
    if (loader) loader.remove();
    h.classList.remove("intro");
    ready();
  }

  /* ---------- clock (shop time, Stockholm) ---------- */
  var tEls = d.querySelectorAll("[data-clock-t]"), dEls = d.querySelectorAll("[data-clock-d]");
  if ((tEls.length || dEls.length) && w.Intl && Intl.DateTimeFormat.prototype.formatToParts) {
    var tz = "Europe/Stockholm";
    var ft = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
    var fd = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "long", year: "numeric" });
    var part = function (parts, type) { for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value; return ""; };
    var tick = function () {
      var now = new Date(), tp = ft.formatToParts(now), dp = fd.formatToParts(now);
      var time = part(tp, "hour") + ":" + part(tp, "minute") + part(tp, "dayPeriod").toLowerCase();
      var date = part(dp, "day") + " " + part(dp, "month") + ", " + part(dp, "year");
      tEls.forEach(function (el) { el.textContent = time; });
      dEls.forEach(function (el) { el.textContent = date; });
    };
    tick(); w.setInterval(tick, 1000);
  }

  /* ---------- menu overlay ---------- */
  var nm = d.getElementById("site-menu");
  var opener = d.querySelector("[data-menu]");
  var outside = [].slice.call(d.querySelectorAll("[data-page]"));
  function openMenu() {
    if (!nm || nm.classList.contains("open")) return;
    nm.classList.add("open"); nm.removeAttribute("aria-hidden");
    outside.forEach(function (el) { el.setAttribute("inert", ""); });
    if (opener) opener.setAttribute("aria-expanded", "true");
    stopScroll();
    var x = nm.querySelector("[data-menu-close]"); if (x) x.focus();
  }
  function closeMenu(skipFocus) {
    if (!nm || !nm.classList.contains("open")) return;
    nm.classList.remove("open"); nm.setAttribute("aria-hidden", "true");
    outside.forEach(function (el) { el.removeAttribute("inert"); });
    if (opener) { opener.setAttribute("aria-expanded", "false"); if (!skipFocus) opener.focus(); }
    startScroll();
  }
  if (nm && opener) {
    nm.setAttribute("aria-hidden", "true");
    opener.addEventListener("click", function (e) { e.preventDefault(); openMenu(); });
    nm.querySelectorAll("[data-menu-close]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); closeMenu(); }); });
    nm.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (!a || a.hasAttribute("data-menu-close")) return;
      if (a.getAttribute("href").indexOf("mailto:") === 0) return;
      var url = new URL(a.href, w.location.href);
      if (!(url.pathname === w.location.pathname && url.hash)) closeMenu(true);
    });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
    if (w.location.hash === "#site-menu" && w.history.replaceState) w.history.replaceState(null, "", w.location.pathname + w.location.search);
  }

  /* ---------- hero card carousel ---------- */
  var hc = d.querySelector(".hcard");
  if (hc) {
    var items = [].slice.call(hc.querySelectorAll(".hcard-item")), dots = [].slice.call(hc.querySelectorAll(".dots i")), cur = 0;
    var go = function (stepBy) {
      var n = items.length, next = (cur + stepBy + n) % n;
      items.forEach(function (it, i) {
        it.classList.toggle("up", stepBy > 0 ? i === cur : i !== next);
        it.setAttribute("aria-hidden", i === next ? "false" : "true");
      });
      dots.forEach(function (dot, i) { dot.classList.toggle("on", i === next); });
      cur = next;
    };
    hc.querySelector(".hcard-row").addEventListener("click", function () { go(1); });
    hc.querySelector(".next-i").addEventListener("click", function (e) { e.stopPropagation(); go(1); });
    hc.querySelector(".prev-i").addEventListener("click", function (e) { e.stopPropagation(); go(-1); });
  }

  /* ---------- liquid cursor reveal ---------- */
  var lq = d.querySelector(".lq");
  if (lq && !reduce && w.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var srcs = (lq.getAttribute("data-reveal") || "").split(","), canvas = lq.querySelector("canvas");
    var ctx = canvas && canvas.getContext("2d");
    if (ctx && srcs[0]) {
      var dpr = Math.min(w.devicePixelRatio || 1, 2), brushRadius = 143, decay = 0.016, FADE_FRAMES = 120;
      var img = new Image(), cover = d.createElement("canvas"), cctx = cover.getContext("2d");
      var brush = d.createElement("canvas"), bctx = brush.getContext("2d");
      var radius = 0, diam = 0, points = [], last = null, idle = FADE_FRAMES + 1, running = false, loaded = false;
      var pick = function () {
        var need = lq.clientWidth * dpr;
        for (var i = 0; i < srcs.length; i++) { var p = srcs[i].trim().split(" "); if (parseInt(p[1], 10) >= need || i === srcs.length - 1) return p[0]; }
      };
      var measure = function () {
        var r = lq.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
        cover.width = canvas.width; cover.height = canvas.height;
        radius = brushRadius * dpr; diam = Math.ceil(radius * 2); brush.width = brush.height = diam;
        if (!loaded) return;
        var s = Math.max(cover.width / img.naturalWidth, cover.height / img.naturalHeight);
        var iw = img.naturalWidth * s, ih = img.naturalHeight * s;
        cctx.drawImage(img, (cover.width - iw) / 2, (cover.height - ih) / 2, iw, ih);
      };
      var stamp = function (x, y) {
        var c = diam / 2;
        bctx.globalCompositeOperation = "source-over";
        bctx.clearRect(0, 0, diam, diam);
        var g = bctx.createRadialGradient(c, c, 0, c, c, c);
        g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.82)"); g.addColorStop(1, "rgba(255,255,255,0)");
        bctx.fillStyle = g; bctx.fillRect(0, 0, diam, diam);
        bctx.globalCompositeOperation = "source-in";
        bctx.drawImage(cover, x - c, y - c, diam, diam, 0, 0, diam, diam);
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(brush, x - c, y - c);
      };
      var tickLq = function () {
        var drawing = points.length > 0;
        if (drawing) idle = 0; else idle += 1;
        if (idle > FADE_FRAMES) { running = false; return; }
        var fade = drawing ? decay : Math.min(decay + idle * 0.004, 0.5);
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0," + fade + ")";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (drawing) { for (var i = 0; i < points.length; i++) stamp(points[i][0], points[i][1]); points.length = 0; }
        if (idle === FADE_FRAMES) ctx.clearRect(0, 0, canvas.width, canvas.height);
        w.requestAnimationFrame(tickLq);
      };
      w.addEventListener("pointermove", function (e) {
        if (!loaded) return;
        var r = canvas.getBoundingClientRect();
        var x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
        if (x < -radius || y < -radius || x > canvas.width + radius || y > canvas.height + radius) { last = null; return; }
        if (last) {
          var dx = x - last[0], dy = y - last[1], dist = Math.sqrt(dx * dx + dy * dy);
          var stepPx = Math.max(radius * 0.3, 1), n = Math.min(Math.ceil(dist / stepPx), 60);
          for (var i = 1; i <= n; i++) points.push([last[0] + dx * i / n, last[1] + dy * i / n]);
        } else points.push([x, y]);
        last = [x, y];
        if (!running) { running = true; w.requestAnimationFrame(tickLq); }
      }, { passive: true });
      img.decoding = "async";
      img.onload = function () { loaded = true; measure(); };
      measure();
      if ("ResizeObserver" in w) new ResizeObserver(measure).observe(lq); else w.addEventListener("resize", measure);
      var load = function () { img.src = pick(); };
      if (d.readyState === "complete") load(); else w.addEventListener("load", load, { once: true });
    }
  }

  /* ---------- stats count-up (scroll-linked: starts as the number enters, done once it is 40% up the viewport) ---------- */
  var nums = [].slice.call(d.querySelectorAll(".stat-n[data-n]"));
  if (nums.length && !reduce) {
    var fmt = function (v) { return v.toLocaleString("en-US"); };
    var lastRun = 0, queued = false;
    var update = function () {
      queued = false; lastRun = Date.now();
      var vh = w.innerHeight;
      nums.forEach(function (el) {
        var r = el.getBoundingClientRect(), target = parseInt(el.getAttribute("data-n"), 10);
        var p = (vh - r.top) / (vh * 0.4);
        p = Math.max(el._p || 0, Math.min(1, p)); // counts up once, never back down
        el._p = p;
        el.firstChild.nodeValue = fmt(Math.round(p * target));
      });
    };
    var onScroll = function () {
      if (queued) return; queued = true;
      w.setTimeout(function () { w.requestAnimationFrame(update); }, Math.max(0, 30 - (Date.now() - lastRun)));
    };
    nums.forEach(function (el) { el.style.minWidth = el.getBoundingClientRect().width + "px"; });
    update();
    w.addEventListener("scroll", onScroll, { passive: true });
    w.addEventListener("resize", onScroll);
  }
})();
