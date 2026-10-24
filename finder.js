/* Carlsson & Co. "What do you need?" product finder. Static and client-side: reads /finder.json
   (built from catalog.json by sitegen/finder.py), no external API. Plain JS, no dependencies. */
(function () {
  "use strict";
  var roots = [].slice.call(document.querySelectorAll("[data-finder]"));
  if (!roots.length) return;

  var STOP = ("a an the and or but for to of in on at by with from into about as is are be am was it its this that these those " +
    "i im me my mine we our us you your yours he she they them their some any something stuff thing things " +
    "need needs want wants wanting looking look find help helping please can could would should will do does make making get " +
    "new good best nice simple easy quick lot lots more most very just also so like what which who how all one my own " +
    "some kind sort type ideas idea").split(" ");
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });

  // Small hand-made synonym map. Keys are typed words; values are extra searches at a lower weight.
  var SYN = {
    carousel: "instagram post", christmas: "holiday", holiday: "christmas", holidays: "christmas", festive: "christmas", lucia: "christmas",
    shop: "small business shop", store: "small business shop", boutique: "small business shop", business: "small business",
    listing: "etsy listing", listings: "etsy listing", seller: "etsy amazon shop", marketplace: "etsy amazon",
    tiktok: "video short", reel: "video short", reels: "video short", shorts: "video short", youtube: "video youtube",
    vlog: "video youtube", ecommerce: "shop product", product: "product shop",
    budget: "budget money", money: "budget money", finance: "money budget", finances: "money budget", savings: "money budget",
    cv: "cv resume", resume: "cv", job: "job career interview", jobs: "job career", interview: "interview job",
    bakery: "restaurant cafe", cafe: "restaurant cafe", coffee: "cafe restaurant", restaurant: "restaurant cafe", food: "restaurant meal recipe",
    social: "social instagram", posts: "social post", post: "social post", caption: "caption instagram social", captions: "caption instagram social",
    email: "email newsletter", newsletter: "email newsletter", blog: "blog seo", seo: "seo blog",
    kids: "family child", kid: "family child", children: "child family", baby: "parent baby", family: "family home",
    wedding: "speech toast wedding", card: "card", cards: "card", invite: "invitation", invitation: "invitation party",
    planner: "planner plan", planning: "planner plan", schedule: "planner calendar", calendar: "calendar planner",
    meal: "meal recipe", meals: "meal recipe", recipes: "recipe", workout: "training fitness", gym: "fitness training",
    excel: "spreadsheet excel", sheets: "spreadsheet", spreadsheet: "spreadsheet excel", code: "developer coding", coding: "developer code",
    ai: "prompt chatgpt", chatgpt: "prompt", gpt: "prompt chatgpt", canva: "canva template", printable: "printable template",
    clients: "client", customers: "customer client", logo: "brand identity", branding: "brand identity", brand: "brand"
  };

  // Short forms that simply mean another word (replaced, so "insta" does not also match "instant").
  var ALIAS = { ig: "instagram", insta: "instagram", gram: "instagram", xmas: "christmas",
    tiktoks: "tiktok", ecom: "ecommerce", biz: "business", ppt: "presentation" };
  // Words the simple stemmer would get wrong ("shopping" is not "shop" in a shop that sells shopping lists).
  var KEEP = { shopping: "shopping", christmas: "christmas", canvas: "canvas", news: "news", series: "series" };

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/e-commerce/g, "ecommerce").replace(/e-mail/g, "email").replace(/&/g, " and ");
  }
  function stem(w) {
    if (w.length <= 3 || /^\d+$/.test(w)) return w;
    if (KEEP[w]) return KEEP[w];
    if (/ies$/.test(w) && w.length > 4) w = w.slice(0, -3) + "y";
    else if (/(ss|us|is)$/.test(w)) { /* keep */ }
    else if (/(ches|shes|xes|zes|sses)$/.test(w)) w = w.slice(0, -2);
    else if (/s$/.test(w)) w = w.slice(0, -1);
    if (/ing$/.test(w) && w.length >= 6) w = w.slice(0, -3);
    else if (/ed$/.test(w) && w.length >= 5) w = w.slice(0, -2);
    if (/([^aeiouls])\1$/.test(w)) w = w.slice(0, -1);
    if (/e$/.test(w) && w.length > 4) w = w.slice(0, -1);
    return w;
  }
  function words(s) {
    return norm(s).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1 || /\d/.test(w); });
  }
  function tokens(s) {
    return words(s).filter(function (w) { return !STOPSET[w]; }).map(stem);
  }

  // Field weights: title and tags count most, then type/category and pitch, then the long text.
  var FIELDS = [["t", 6], ["g", 3.5], ["y", 3], ["p", 3], ["d", 1.5], ["n", 1]];
  var KIND = { pack: 1, template: 1, set: 0.75, library: 0.55, guide: 0.6 };
  var MAX = 6, MIN_SHOW = 3, MIN_SCORE = 2;

  var data = null, loading = null, df = {}, vocab = [], N = 1;

  function prepare(json) {
    data = json;
    N = json.items.length;
    json.items.forEach(function (it) {
      it._f = {};
      var all = {};
      FIELDS.forEach(function (f) {
        var set = {};
        tokens(it[f[0]]).forEach(function (t) { set[t] = 1; all[t] = 1; });
        it._f[f[0]] = set;
      });
      it._all = Object.keys(all);
      it._hay = " " + tokens([it.t, it.g, it.p, it.d].join(" ")).join(" ") + " ";
      it._all.forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    vocab = Object.keys(df);
  }
  function load(root) {
    if (data) return Promise.resolve(data);
    if (!loading) {
      loading = fetch(root + "finder.json", { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) { prepare(j); return j; });
      loading.catch(function () { loading = null; });
    }
    return loading;
  }
  var idfCache = {};
  function idf(tok, prefix) {
    var key = (prefix ? "~" : "") + tok;
    if (key in idfCache) return idfCache[key];
    var n = 0;
    if (prefix) vocab.forEach(function (v) { if (v.indexOf(tok) === 0) n = Math.max(n, df[v]); });
    else n = df[tok] || 0;
    return (idfCache[key] = Math.log(1 + N / Math.max(n, 1)));
  }

  // Query -> concept groups. Each typed word is one group: itself (weight 1) plus synonyms (0.75).
  function parse(q) {
    var groups = [], intent = { template: 0, pack: 0 }, kept = [];
    words(q).forEach(function (w) {
      if (ALIAS[w]) w = ALIAS[w];
      if (!STOPSET[w]) kept.push(stem(w));
      if (/^(template|templates|canva|printable|printables)$/.test(w)) intent.template = 1;
      if (/^(prompt|prompts|chatgpt|gpt|ai|claude|gemini)$/.test(w)) intent.pack = 1;
      var extra = SYN[w];
      if (STOPSET[w] && !extra) return;
      var g = [];
      var seen = {};
      if (!STOPSET[w]) { var s = stem(w); g.push([s, 1]); seen[s] = 1; }
      if (extra) tokens(extra).forEach(function (t) { if (!seen[t]) { g.push([t, 0.75]); seen[t] = 1; } });
      if (g.length) groups.push(g);
    });
    var phrases = [];
    for (var i = 1; i < kept.length; i++) phrases.push(" " + kept[i - 1] + " " + kept[i] + " ");
    return { groups: groups, intent: intent, phrases: phrases };
  }
  function scoreItem(it, q) {
    var total = 0, hit = 0;
    q.groups.forEach(function (g) {
      var best = 0;
      g.forEach(function (pair) {
        var tok = pair[0], wq = pair[1], s = 0;
        FIELDS.forEach(function (f) {
          var set = it._f[f[0]];
          if (set[tok]) s += f[1] * idf(tok, false);
          else if (tok.length >= 3 && !df[tok]) {
            for (var k in set) { if (k.length > tok.length && k.indexOf(tok) === 0) { s += f[1] * 0.55 * idf(tok, true); break; } }
          }
        });
        best = Math.max(best, s * wq);
      });
      if (best > 0) hit += 1;
      total += best;
    });
    if (!hit) return 0;
    var cov = hit / q.groups.length;
    var mult = (KIND[it.k] || 1) * (0.15 + 0.85 * cov * cov);
    // typed words found side by side ("small business", "meal plan") count extra
    if (q.phrases.length) {
      var hay = it._hay;
      q.phrases.forEach(function (ph) { if (hay.indexOf(ph) >= 0) mult *= 1.4; });
    }
    if (q.intent.template && it.k === "template") mult *= 1.35;
    if (q.intent.pack && it.k === "pack") mult *= 1.2;
    if (it.k !== "guide" && !it.b) mult *= 0.8;
    return total * mult;
  }
  function search(qs) {
    var q = parse(qs);
    if (!q.groups.length) return [];
    var scored = data.items.map(function (it) { return { it: it, s: scoreItem(it, q) }; })
      .filter(function (r) { return r.s >= MIN_SCORE; })
      .sort(function (a, b) { return b.s - a.s; });
    if (!scored.length) return [];
    var cut = scored[0].s * 0.33, out = [], guides = 0;
    for (var i = 0; i < scored.length && out.length < MAX; i++) {
      var r = scored[i];
      if (r.s < cut && out.length >= MIN_SHOW) break;
      if (r.it.k === "guide") { if (guides) continue; guides = 1; }
      out.push(r.it);
    }
    // a free guide is a bonus, never ahead of a product
    out.sort(function (a, b) { return (a.k === "guide") - (b.k === "guide"); });
    return out;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var ARROW = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var MARK = '<svg class="i" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 10.5c7.4-2.7 14.4-1.7 20.4 2.6V41C17.4 36.7 10.4 35.7 3 38.4Zm42 0c-7.4-2.7-14.4-1.7-20.4 2.6V41c6-4.3 13-5.3 20.4-2.6Z"/></svg>';

  function card(it, root, i) {
    var guide = it.k === "guide";
    var url = root + (guide ? "guides/" + it.s + ".html" : "p/" + it.s + "/");
    var cover = it.c
      ? '<img src="' + esc(root + "img/covers/" + it.s + "-480.webp") + '" width="480" height="360" alt="" loading="lazy" decoding="async">'
      : '<span class="nf-tile">' + MARK + "</span>";
    var price = guide ? "Free" : "$" + it.$ + (it.w ? ' <s><span class="sr">was </span>$' + it.w + "</s>" : "");
    var buy = it.b
      ? '<a class="nf-buy" href="' + esc(it.b) + '" data-buy="' + esc(it.s) + '" aria-label="' + esc("Buy " + it.t + " on Gumroad, $" + it.$) + '">Buy</a>'
      : (guide ? "" : '<span class="nf-buy soon">Coming soon</span>');
    return '<li class="nf-item" style="--i:' + i + '"><article class="nf-card nf-' + esc(it.k) + '">' +
      '<div class="nf-img" aria-hidden="true">' + cover + "</div>" +
      '<div class="nf-body"><p class="nf-meta">' + esc(it.y) + (it.m ? " \u00b7 " + esc(it.m) : "") + "</p>" +
      '<h3 class="nf-name"><a class="nf-link" href="' + esc(url) + '">' + esc(it.t) + "</a></h3>" +
      '<p class="nf-pitch">' + esc(it.p) + "</p>" +
      '<div class="nf-foot"><span class="nf-price">' + price + "</span>" + buy +
      '<span class="nf-badge" aria-hidden="true">' + ARROW + "</span></div></div></article></li>";
  }

  roots.forEach(function (box) {
    var root = box.getAttribute("data-root") || "./";
    var form = box.querySelector("[data-nf-form]");
    var input = box.querySelector(".nf-input");
    var out = box.querySelector("[data-nf-out]");
    var list = box.querySelector("[data-nf-list]");
    var count = box.querySelector("[data-nf-count]");
    var empty = box.querySelector("[data-nf-empty]");
    var mail = box.querySelector("[data-nf-mail]");
    var clear = box.querySelector("[data-nf-clear]");
    var status = box.querySelector("[role=status]");
    var mailBase = mail ? mail.getAttribute("href").split("?")[0] : "";
    var timer = 0, last = null;
    if (window.matchMedia && matchMedia("(max-width: 639px)").matches) input.setAttribute("placeholder", "e.g. bakery posts");

    function render(q) {
      q = q.trim();
      if (q === last) return;
      last = q;
      if (!q) { out.hidden = true; list.innerHTML = ""; status.textContent = ""; return; }
      var res = search(q), none = !res.length;
      if (none) res = data.start.map(function (s) { return data.items.filter(function (x) { return x.s === s; })[0]; }).filter(Boolean);
      list.innerHTML = res.map(function (it, i) { return card(it, root, i); }).join("");
      empty.hidden = !none;
      list.classList.toggle("nf-start", none);
      out.classList.toggle("is-empty", none);
      count.textContent = none ? "Good places to start" : res.length + (res.length === 1 ? " suggestion" : " suggestions") + " for \u201c" + q + "\u201d";
      if (mail) mail.setAttribute("href", mailBase + "?subject=" + encodeURIComponent("What I need") +
        "&body=" + encodeURIComponent("Hi! I was looking for: " + q + "\n\n"));
      status.textContent = none
        ? "No match for " + q + ". Showing " + res.length + " good places to start, and a link to tell us what you need."
        : res.length + (res.length === 1 ? " suggestion" : " suggestions") + " for " + q + ". Press the down arrow to browse them.";
      out.hidden = false;
      out.classList.remove("nf-anim");
      void out.offsetWidth;
      out.classList.add("nf-anim");
    }
    function run(now) {
      clearTimeout(timer);
      var go = function () {
        load(root).then(function () { render(input.value); }).catch(function () {
          status.textContent = "Suggestions could not load. Please browse the categories instead.";
        });
      };
      if (now) go(); else timer = setTimeout(go, 110);
    }
    function links() { return [].slice.call(list.querySelectorAll(".nf-link")); }

    ["focus", "pointerenter", "touchstart"].forEach(function (ev) {
      (ev === "focus" ? input : box).addEventListener(ev, function () { load(root).catch(function () {}); }, { once: true, passive: true });
    });
    input.addEventListener("input", function () { run(false); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      run(true);
      var first = links()[0];
      if (first && input.value.trim()) setTimeout(function () { var f = links()[0]; if (f) f.focus(); }, 160);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { var f = links()[0]; if (f) { e.preventDefault(); f.focus(); } }
      else if (e.key === "Escape" && input.value) { e.preventDefault(); input.value = ""; run(true); }
    });
    list.addEventListener("keydown", function (e) {
      var all = links(), i = all.indexOf(document.activeElement);
      if (i < 0) {
        var li = document.activeElement && document.activeElement.closest && document.activeElement.closest(".nf-item");
        if (li) i = all.indexOf(li.querySelector(".nf-link"));
      }
      if (i < 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); (all[i + 1] || all[i]).focus(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); if (i === 0) input.focus(); else all[i - 1].focus(); }
      else if (e.key === "Home") { e.preventDefault(); all[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); all[all.length - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); input.focus(); }
    });
    // whole card is clickable (the title link is the real target; buy keeps its own link)
    list.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var c = e.target.closest(".nf-card");
      if (c && !(window.getSelection && String(window.getSelection()))) c.querySelector(".nf-link").click();
    });
    [].slice.call(box.querySelectorAll("[data-chip]")).forEach(function (chip) {
      chip.addEventListener("click", function () {
        input.value = chip.getAttribute("data-chip");
        run(true);
        input.focus();
      });
    });
    if (clear) clear.addEventListener("click", function () { input.value = ""; run(true); input.focus(); });

    var pre = (function () { try { return new URLSearchParams(location.search).get("need"); } catch (e) { return null; } })();
    if (pre && box === roots[0]) { input.value = pre; run(true); }
  });
})();
