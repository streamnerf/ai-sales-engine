/*! Carlsson & Co. motion layer.
 * Progressive enhancement only: all content is in the HTML and visible without this file.
 * Uses GSAP + ScrollTrigger (GSAP Standard License, https://gsap.com/standard-license)
 * and Lenis (MIT, darkroom.engineering).
 * Word blur reveal, magnetic buttons and shine are vanilla ports in the spirit of React Bits
 * BlurText, Magnet and ShinyText - https://github.com/DavidHDev/react-bits
 * React Bits: Copyright (c) 2026 David Haz, MIT + Commons Clause License Condition v1.0.
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software. Full texts: motion/LICENSES.txt
 */
(function () {
  "use strict";
  var w = window, d = document, root = d.documentElement;
  if (!w.gsap || !w.ScrollTrigger) return;
  if (w.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var gsap = w.gsap, ST = w.ScrollTrigger;
  gsap.registerPlugin(ST);
  root.classList.add("wow");

  var fine = w.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var wide = w.matchMedia("(min-width: 901px)").matches;
  var EASE = "power3.out";

  /* ---------- Lenis smooth scroll (desktop mouse/trackpad only; touch stays native) ---------- */
  var lenis = null;
  if (fine && w.Lenis) {
    lenis = new w.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on("scroll", ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);

    // Same-page anchor links (#library, #sets, #faq, #bundle ...). Scroll-margin is respected by Lenis.
    d.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a[href*='#']");
      if (!a || a.classList.contains("skip")) return;
      var url = new URL(a.href, w.location.href);
      if (url.pathname !== w.location.pathname || url.host !== w.location.host || !url.hash) return;
      var id = decodeURIComponent(url.hash.slice(1));
      var el = d.getElementById(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { duration: 1.2 });
      if (history.pushState) history.pushState(null, "", "#" + id);
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    });
    // Pause page scrolling behind the Preview dialog.
    var pv = d.getElementById("pv");
    if (pv && w.MutationObserver) {
      new MutationObserver(function () { pv.open ? lenis.stop() : lenis.start(); })
        .observe(pv, { attributes: true, attributeFilter: ["open"] });
    }
  }

  function below(el) {
    var r = el.getBoundingClientRect();
    return r.height > 0 && r.top > w.innerHeight * 0.92;
  }

  /* ---------- BlurText port: section headings reveal word by word ---------- */
  function splitWords(el) {
    var n = 0, walker = d.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], t;
    while ((t = walker.nextNode())) nodes.push(t);
    nodes.forEach(function (node) {
      var parts = node.nodeValue.split(/(\s+)/), frag = d.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(p)); return; }
        var s = d.createElement("span");
        s.className = "w"; s.textContent = p; n++;
        frag.appendChild(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return el.querySelectorAll(".w");
  }
  gsap.utils.toArray("main .head h2, .bundle h2, .about h2, .faq h2").forEach(function (h) {
    if (!below(h)) return;
    var words = splitWords(h);
    gsap.set(words, { opacity: 0, y: "-0.3em", filter: "blur(8px)" });
    ST.create({
      trigger: h, start: "top 88%", once: true,
      onEnter: function () {
        gsap.to(words, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: EASE, stagger: 0.07,
          onComplete: function () { gsap.set(words, { clearProps: "filter,transform" }); } });
      }
    });
  });

  /* ---------- Cards, covers, sets, guides: soft staggered rise ---------- */
  var pending = gsap.utils.toArray(
    ".grid > .card, .sets > .set, .glist > a, .minis > a, .faq details, .about > div > p, .head > p, .bundle > div, .fd-card, .look-pages figure"
  ).filter(below);
  gsap.set(pending, { opacity: 0, y: 28 });
  pending.forEach(function (el) {
    if (el.matches(".look-pages figure")) gsap.set(el, { clipPath: "inset(14% 0% 0% 0%)" });
  });
  var batch = ST.batch(pending, {
    start: "top 92%", once: true,
    onEnter: function (els) {
      // Anything already scrolled past (fast scroll, anchor jump) appears at once; the rest staggers, capped.
      var past = els.filter(function (el) { return el.getBoundingClientRect().bottom < 0; });
      var now = els.filter(function (el) { return past.indexOf(el) < 0; });
      if (past.length) gsap.set(past, { opacity: 1, clearProps: "transform,clipPath", overwrite: true });
      if (now.length) gsap.to(now, { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: EASE,
        stagger: { amount: Math.min(0.45, (now.length - 1) * 0.09) }, overwrite: true,
        onComplete: function () { gsap.set(now, { clearProps: "transform,clipPath" }); } });
    }
  });
  // Search / filters reveal everything at once so filtered results never sit invisible.
  var lib = d.getElementById("lib");
  if (lib) {
    var flush = function () {
      if (pending) {
        batch.forEach(function (t) { t.kill(); });
        gsap.to(pending.filter(function (el) { return el.closest("#library"); }),
          { opacity: 1, y: 0, duration: 0.35, overwrite: true, clearProps: "transform" });
        pending = pending.filter(function (el) { return !el.closest("#library"); });
      }
      requestAnimationFrame(function () { ST.refresh(); if (lenis) lenis.resize(); });
    };
    var q = d.getElementById("q");
    if (q) q.addEventListener("input", flush);
    d.querySelectorAll(".filters button").forEach(function (b) { b.addEventListener("click", flush); });
  }

  /* ---------- Count-up where numbers are already shown ---------- */
  gsap.utils.toArray(".count[data-n]").forEach(function (el) {
    if (!below(el)) return;
    var to = parseInt(el.getAttribute("data-n"), 10);
    if (!to) return;
    el.style.minWidth = el.getBoundingClientRect().width + "px";
    var o = { v: 0 };
    ST.create({ trigger: el, start: "top 90%", once: true, onEnter: function () {
      gsap.to(o, { v: to, duration: 1.6, ease: "power2.out",
        onUpdate: function () { el.textContent = Math.round(o.v); },
        onComplete: function () { el.textContent = to; } });
    } });
    el.textContent = "0";
  });

  /* ---------- How it works: pinned, scrubbed three steps (wide screens) ---------- */
  var how = d.querySelector(".how");
  if (how) {
    var steps = gsap.utils.toArray(".how .steps > div");
    steps.forEach(function (s) { var i = d.createElement("i"); i.className = "step-line"; i.setAttribute("aria-hidden", "true"); s.prepend(i); });
    var lines = how.querySelectorAll(".step-line");
    if (wide && below(how)) {
      gsap.set(steps, { opacity: 0.22, y: 18 });
      gsap.set(lines, { scaleX: 0 });
      var tl = gsap.timeline({ scrollTrigger: { trigger: how, start: "center center", end: "+=110%", pin: true, scrub: 0.8 } });
      steps.forEach(function (s, i) {
        tl.to(lines[i], { scaleX: 1, duration: 1, ease: "none" }, i)
          .to(s, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, i + 0.1);
      });
      tl.to({}, { duration: 0.4 });
    } else if (below(how)) {
      gsap.set(lines, { scaleX: 0 });
      gsap.set(steps, { opacity: 0, y: 24 });
      ST.create({ trigger: how, start: "top 85%", once: true, onEnter: function () {
        gsap.to(lines, { scaleX: 1, duration: 1, ease: EASE, stagger: 0.18 });
        gsap.to(steps, { opacity: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.18 });
      } });
    }
  }

  /* ---------- Gentle parallax (wide screens) ---------- */
  if (wide) {
    var stage = d.querySelector(".hero-stage");
    if (stage) gsap.to(stage, { yPercent: 9, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.utils.toArray(".pcover").forEach(function (fig) {
      var img = fig.querySelector("img"); if (!img) return;
      gsap.fromTo(img, { yPercent: -3, scale: 1.08 }, { yPercent: 3, scale: 1.08, ease: "none",
        scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true } });
    });
    gsap.utils.toArray(".sale-card .cover img, .set .cover img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -2.5, scale: 1.06 }, { yPercent: 2.5, scale: 1.06, ease: "none",
        scrollTrigger: { trigger: img.parentNode, start: "top bottom", end: "bottom top", scrub: true } });
    });
  }

  /* ---------- Magnet port: primary buttons lean toward the pointer (spring) ---------- */
  if (fine) {
    gsap.utils.toArray(".btn.solid:not(.soon), .bundle .btn:not(.soon)").forEach(function (btn) {
      var x = gsap.quickTo(btn, "x", { duration: 0.6, ease: "elastic.out(1, 0.55)" });
      var y = gsap.quickTo(btn, "y", { duration: 0.6, ease: "elastic.out(1, 0.55)" });
      var max = 7;
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        x(gsap.utils.clamp(-max, max, dx / 6)); y(gsap.utils.clamp(-max, max, dy / 4));
      });
      btn.addEventListener("pointerleave", function () { x(0); y(0); });
    });
  }

  w.addEventListener("load", function () { ST.refresh(); });
})();
