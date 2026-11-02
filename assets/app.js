/* Shopsmith Mark V Guide - static single-page app (no build step). */
(function () {
  "use strict";

  var state = { sections: [], parts: [], partsById: {} };
  var LS = window.localStorage;
  var $main = document.getElementById("main");
  var $nav = document.getElementById("nav");

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }
  function getText(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.text();
    });
  }
  function checks(id) {
    try { return JSON.parse(LS.getItem("ss.checks." + id) || "{}"); } catch (e) { return {}; }
  }
  function saveChecks(id, obj) { LS.setItem("ss.checks." + id, JSON.stringify(obj)); }
  function settings() {
    try { return JSON.parse(LS.getItem("ss.settings") || "{}"); } catch (e) { return {}; }
  }

  // ---------- navigation ----------
  function renderNav(active) {
    var html = '<a href="#/" class="' + (active === "home" ? "active" : "") + '">Home</a>';
    var group = null;
    state.sections.forEach(function (s) {
      if (s.group !== group) { group = s.group; html += '<div class="grp">' + esc(group) + "</div>"; }
      var c = checks(s.id), n = Object.keys(c).filter(function (k) { return c[k]; }).length;
      html += '<a href="#/guide/' + esc(s.id) + '" class="' + (active === s.id ? "active" : "") + '">' +
        esc(s.title) + (n ? '<span class="done">&#10003;' + n + "</span>" : "") + "</a>";
    });
    html += '<div class="grp">Tools</div>' +
      '<a href="#/identify" class="' + (active === "identify" ? "active" : "") + '">&#128247; Identify a part</a>' +
      '<a href="#/parts" class="' + (active === "parts" ? "active" : "") + '">Parts catalog</a>' +
      '<a href="#/settings" class="' + (active === "settings" ? "active" : "") + '">Settings</a>';
    $nav.innerHTML = html;
  }

  // ---------- pages ----------
  function pageHome() {
    renderNav("home");
    var tiles = state.sections.map(function (s) {
      return '<a href="#/guide/' + esc(s.id) + '"><b>' + esc(s.title) + "</b><span class='muted'>" + esc(s.blurb || "") + "</span></a>";
    }).join("");
    $main.innerHTML =
      "<h1>Shopsmith Mark V Guide</h1>" +
      "<p>A personal, step-by-step guide for a 2003 Shopsmith Mark V with the Planer and Belt Sander. " +
      "Work through the checklists (progress is saved in this browser), or tap <b>Identify</b> to photograph a part.</p>" +
      '<div class="toolbar"><a class="btn primary" href="#/identify">&#128247; Identify a part</a>' +
      '<a class="btn" href="#/parts">Browse parts</a></div>' +
      '<div class="home-tiles">' + tiles + "</div>" +
      '<p class="muted" style="margin-top:24px">Steps are summarized from the Shopsmith owner&#39;s manuals, with page references like ' +
      '<span class="cite">[520S Owner&#39;s Manual p.23]</span>. Always follow your manual and the safety labels on your machine.</p>';
  }

  function pageGuide(id) {
    var s = state.sections.filter(function (x) { return x.id === id; })[0];
    if (!s) return pageNotFound();
    renderNav(id);
    $main.innerHTML = "<p>Loading&hellip;</p>";
    getText("content/" + s.file).then(function (md) {
      var html = DOMPurify.sanitize(marked.parse(md));
      // style citations like [Doc p.3]
      html = html.replace(/\[([^\[\]<>]{2,80}?\bp+\.\s?[\d\u2013\-, ]+)\]/g, '<span class="cite">[$1]</span>');
      $main.innerHTML = '<div class="toolbar"><button id="resetChecks">Reset checklist</button>' +
        '<button onclick="window.print()">Print</button></div><div class="progress"><div id="prog"></div></div>' + html +
        sectionPartsHtml(id) + navFooter(id);
      wireChecklist(id);
      document.getElementById("resetChecks").onclick = function () {
        if (confirm("Clear the checkboxes on this page?")) { saveChecks(id, {}); pageGuide(id); }
      };
      var anchor = (location.hash.split("?a=")[1] || "");
      if (anchor) { var el = document.getElementById(anchor); if (el) el.scrollIntoView(); } else window.scrollTo(0, 0);
    }).catch(function (e) { $main.innerHTML = '<div class="err">Could not load section: ' + esc(e.message) + "</div>"; });
  }

  function wireChecklist(id) {
    var saved = checks(id);
    var boxes = $main.querySelectorAll('input[type="checkbox"]');
    boxes.forEach(function (b, i) {
      b.disabled = false;
      var li = b.closest("li");
      if (li) {
        li.classList.add("task");
        // wrap text in a label so tapping the text toggles the box
        var lab = document.createElement("label");
        while (b.nextSibling) lab.appendChild(b.nextSibling);
        lab.insertBefore(b, lab.firstChild);
        li.appendChild(lab);
      }
      b.checked = !!saved[i];
      if (li) li.classList.toggle("checked", b.checked);
      b.addEventListener("change", function () {
        var c = checks(id); c[i] = b.checked; saveChecks(id, c);
        if (li) li.classList.toggle("checked", b.checked);
        progress(); renderNav(id);
      });
    });
    function progress() {
      var n = 0; boxes.forEach(function (b) { if (b.checked) n++; });
      var p = document.getElementById("prog");
      if (p) p.style.width = boxes.length ? (100 * n / boxes.length) + "%" : "0";
      p.parentNode.style.display = boxes.length ? "" : "none";
    }
    progress();
  }

  function sectionPartsHtml(id) {
    var list = state.parts.filter(function (p) { return p.guide_section === id; });
    if (!list.length) return "";
    return "<h2>Parts used in this section</h2><div class='cards'>" + list.map(partCard).join("") + "</div>";
  }

  function navFooter(id) {
    var i = state.sections.findIndex(function (s) { return s.id === id; });
    var prev = state.sections[i - 1], next = state.sections[i + 1];
    return '<div class="toolbar" style="margin-top:30px;justify-content:space-between">' +
      (prev ? '<a class="btn" href="#/guide/' + esc(prev.id) + '">&larr; ' + esc(prev.title) + "</a>" : "<span></span>") +
      (next ? '<a class="btn primary" href="#/guide/' + esc(next.id) + '">' + esc(next.title) + " &rarr;</a>" : "") + "</div>";
  }

  function partCard(p) {
    return '<div class="card" id="part-' + esc(p.id) + '"><h3>' + esc(p.name) + "</h3>" +
      '<div class="meta">' + esc(p.category) + (p.part_numbers && p.part_numbers.length ? " &middot; #" + esc(p.part_numbers.join(", #")) : "") + "</div>" +
      "<p><b>Looks like:</b> " + esc(p.visual) + "</p>" +
      "<p><b>Mount:</b> " + esc(p.mount) + "</p>" +
      "<p><b>Use:</b> " + esc(p.use) + "</p>" +
      (p.used_in || []).map(function (u) { return '<span class="pill">' + esc(u) + "</span>"; }).join("") +
      (p.refs && p.refs.length ? '<div class="cite">' + esc(p.refs.join("; ")) + "</div>" : "") +
      (p.guide_section ? '<p><a href="#/guide/' + esc(p.guide_section) + '">Open guide section &rarr;</a></p>' : "") + "</div>";
  }

  function pageParts() {
    renderNav("parts");
    var cats = Array.from(new Set(state.parts.map(function (p) { return p.category; }))).sort();
    $main.innerHTML = "<h1>Parts catalog</h1><p class='muted'>" + state.parts.length +
      " parts. Search by name, part number, or what it looks like.</p>" +
      '<div class="toolbar" style="flex-wrap:nowrap"><input type="search" id="q" placeholder="e.g. quill, 555, round disc with holes">' +
      '<select id="cat" style="max-width:220px"><option value="">All categories</option>' +
      cats.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select></div>" +
      '<div class="cards" id="plist"></div>';
    var q = document.getElementById("q"), cat = document.getElementById("cat");
    function draw() {
      var t = q.value.toLowerCase().trim(), c = cat.value;
      var list = state.parts.filter(function (p) {
        if (c && p.category !== c) return false;
        if (!t) return true;
        return [p.name, p.visual, p.use, (p.part_numbers || []).join(" "), (p.used_in || []).join(" ")]
          .join(" ").toLowerCase().indexOf(t) >= 0;
      });
      document.getElementById("plist").innerHTML = list.map(partCard).join("") || "<p>No matches.</p>";
    }
    q.oninput = draw; cat.onchange = draw; draw();
  }

  // ---------- settings ----------
  var PROVIDERS = {
    anthropic: { label: "Anthropic (Claude)", model: "claude-sonnet-4-5", keyUrl: "https://console.anthropic.com/settings/keys" },
    openai: { label: "OpenAI", model: "gpt-4o", keyUrl: "https://platform.openai.com/api-keys" },
    gemini: { label: "Google Gemini", model: "gemini-2.5-flash", keyUrl: "https://aistudio.google.com/app/apikey" }
  };

  function pageSettings() {
    renderNav("settings");
    var s = settings(), prov = s.provider || "anthropic";
    $main.innerHTML = "<h1>Settings</h1>" +
      '<div class="warn">Photo identification sends your photo straight from this browser to the AI provider you pick, using <b>your own API key</b>. ' +
      "The key is stored only in this browser (localStorage). It is never sent to GitHub or anywhere else. Each identification costs a small amount on your provider account. " +
      "Use a key with a spending limit, and don&#39;t use this on a shared computer.</div>" +
      "<h2>AI provider</h2>" +
      '<p><select id="prov">' + Object.keys(PROVIDERS).map(function (k) {
        return '<option value="' + k + '"' + (k === prov ? " selected" : "") + ">" + PROVIDERS[k].label + "</option>";
      }).join("") + "</select></p>" +
      '<p><label>API key <a id="keyUrl" target="_blank" rel="noopener">(get a key)</a><br><input type="password" id="key" autocomplete="off"></label></p>' +
      '<p><label>Model<br><input type="text" id="model"></label><br><span class="muted">Must be a model that accepts images. Change this if the provider retires the default.</span></p>' +
      '<div class="toolbar"><button class="primary" id="save">Save</button><button id="forget">Forget key</button></div><p id="msg"></p>' +
      "<h2>Progress</h2><p>Checklist progress is saved in this browser.</p><button id=\"resetAll\">Reset all checklists</button>";
    var $p = document.getElementById("prov"), $k = document.getElementById("key"), $m = document.getElementById("model");
    function load() {
      var p = $p.value, keys = s.keys || {}, models = s.models || {};
      $k.value = keys[p] || ""; $m.value = models[p] || PROVIDERS[p].model;
      document.getElementById("keyUrl").href = PROVIDERS[p].keyUrl;
    }
    $p.onchange = load; load();
    document.getElementById("save").onclick = function () {
      s.provider = $p.value; s.keys = s.keys || {}; s.models = s.models || {};
      s.keys[$p.value] = $k.value.trim(); s.models[$p.value] = $m.value.trim() || PROVIDERS[$p.value].model;
      LS.setItem("ss.settings", JSON.stringify(s));
      document.getElementById("msg").textContent = "Saved.";
    };
    document.getElementById("forget").onclick = function () {
      if (s.keys) delete s.keys[$p.value];
      LS.setItem("ss.settings", JSON.stringify(s)); load();
      document.getElementById("msg").textContent = "Key removed from this browser.";
    };
    document.getElementById("resetAll").onclick = function () {
      if (!confirm("Clear all checklist progress?")) return;
      Object.keys(LS).forEach(function (k) { if (k.indexOf("ss.checks.") === 0) LS.removeItem(k); });
      renderNav("settings");
    };
  }

  // ---------- identify ----------
  var SNOWFLAKE_APP_URL = "https://app.snowflake.com/sfsenorthamerica/dfreriks_aws1_w2/#/streamlit-apps/SHOPSMITH_GUIDE.APP.PART_ID";

  function pageIdentify() {
    renderNav("identify");
    var s = settings(), prov = s.provider || "anthropic", key = (s.keys || {})[prov];
    $main.innerHTML = "<h1>&#128247; Identify a part</h1>" +
      '<div class="result"><h3 style="margin-top:0">Snowflake Part ID app (recommended)</h3>' +
      "<p>Sign in with Snowflake, take a photo, and Cortex AI matches it against this guide&#39;s parts catalog. No API key needed.</p>" +
      '<p><a class="btn primary" href="' + SNOWFLAKE_APP_URL + '" target="_blank" rel="noopener">Open Part ID app</a></p></div>' +
      '<h2>Or use your own AI key</h2>' +
      (key ? "" : '<p class="muted">Needs an Anthropic, OpenAI, or Gemini key in <a href="#/settings">Settings</a>.</p>') +
      '<div class="drop"><p><label class="btn primary">Take or choose a photo<input type="file" id="file" accept="image/*" capture="environment" hidden></label></p>' +
      '<p class="muted">Use good light and fill the frame. Put a coin or tape measure in the shot for scale. Photograph any stamped numbers.</p>' +
      '<p><input type="text" id="hint" placeholder="Optional hint, e.g. &quot;found in the planer box&quot;"></p></div>' +
      '<img id="prev" class="preview" hidden><div id="out"></div>';
    document.getElementById("file").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      shrink(f, 1280).then(function (dataUrl) {
        var img = document.getElementById("prev"); img.src = dataUrl; img.hidden = false;
        identify(dataUrl, document.getElementById("hint").value);
      }).catch(function (err) { showErr(err); });
    };
  }

  function shrink(file, max) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(new Error("Could not read the photo.")); };
      r.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("Unsupported image format. Try a JPEG or PNG.")); };
        img.onload = function () {
          var sc = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.85));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  function catalogPrompt(hint) {
    var cat = state.parts.map(function (p) {
      return p.id + " | " + p.name + " | " + p.category + " | " + p.visual +
        (p.part_numbers && p.part_numbers.length ? " | #" + p.part_numbers.join(",") : "");
    }).join("\n");
    return "You identify parts and accessories for a Shopsmith Mark V woodworking machine (2003, likely Model 520) " +
      "that has a Planer and Belt Sander special-purpose tools. Look at the photo and match it to the catalog below " +
      "(format: id | name | category | appearance | part numbers).\n\nCATALOG:\n" + cat +
      "\n\n" + (hint ? "Owner's hint: " + hint + "\n\n" : "") +
      "Reply with ONLY a JSON object, no markdown, in this shape:\n" +
      '{"matches":[{"id":"<catalog id>","confidence":0-100,"reason":"what in the photo matches"}],' +
      '"not_in_catalog":"if nothing fits, your best plain-language guess of what it is, else empty string",' +
      '"is_shopsmith":true|false,"photo_tips":"how to retake the photo if unsure, else empty string"}\n' +
      "Give up to 3 matches, best first. Only use ids from the catalog. Be honest about low confidence.";
  }

  function callModel(prov, key, model, dataUrl, prompt) {
    var b64 = dataUrl.split(",")[1];
    if (prov === "anthropic") {
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: model, max_tokens: 800, messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
          { type: "text", text: prompt }] }] })
      }).then(asJson).then(function (j) { return j.content.map(function (c) { return c.text || ""; }).join(""); });
    }
    if (prov === "openai") {
      return fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Bearer " + key },
        body: JSON.stringify({ model: model, max_tokens: 800, response_format: { type: "json_object" },
          messages: [{ role: "user", content: [{ type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } }] }] })
      }).then(asJson).then(function (j) { return j.choices[0].message.content; });
    }
    return fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
        generationConfig: { responseMimeType: "application/json" } })
    }).then(asJson).then(function (j) { return j.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join(""); });
  }

  function asJson(r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) {
        var m = (j.error && (j.error.message || j.error.type)) || ("HTTP " + r.status);
        throw new Error(m);
      }
      return j;
    });
  }

  function parseReply(text) {
    var m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("The model did not return a usable answer.");
    return JSON.parse(m[0]);
  }

  function identify(dataUrl, hint) {
    var s = settings(), prov = s.provider || "anthropic", key = (s.keys || {})[prov];
    var model = (s.models || {})[prov] || PROVIDERS[prov].model;
    var out = document.getElementById("out");
    if (!key) { out.innerHTML = '<div class="warn">Add an API key in <a href="#/settings">Settings</a>.</div>'; return; }
    out.innerHTML = "<p>Identifying with " + esc(PROVIDERS[prov].label) + " (" + esc(model) + ")&hellip;</p>";
    callModel(prov, key, model, dataUrl, catalogPrompt(hint)).then(parseReply).then(function (r) {
      var html = "";
      if (r.is_shopsmith === false) html += '<div class="warn">This may not be a Shopsmith part.</div>';
      (r.matches || []).forEach(function (m, i) {
        var p = state.partsById[m.id];
        if (!p) return;
        html += '<div class="result' + (i ? " alt" : "") + '"><div class="conf">' + (i ? "Possible match" : "Best match") +
          " &middot; " + esc(Math.round(Number(m.confidence) || 0)) + "% confident</div>" +
          '<p class="muted">' + esc(m.reason) + "</p>" + partCard(p) + "</div>";
      });
      if (r.not_in_catalog) html += '<div class="result alt"><b>Not in the catalog. Best guess:</b> ' + esc(r.not_in_catalog) + "</div>";
      if (r.photo_tips) html += '<p class="muted"><b>Photo tip:</b> ' + esc(r.photo_tips) + "</p>";
      out.innerHTML = html || "<p>No match found. Try a closer, well-lit photo.</p>";
    }).catch(showErr);
  }

  function showErr(e) {
    var msg = e && e.message ? e.message : String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      // OpenAI omits CORS headers on auth errors, so a bad key surfaces as a network failure.
      msg += " Check your internet connection" +
        ((settings().provider === "openai") ? ", and check that your OpenAI API key is valid and has credit." : ".");
    }
    document.getElementById("out").innerHTML = '<div class="err">' + esc(msg) + "</div>";
  }

  function pageNotFound() { renderNav(""); $main.innerHTML = "<h1>Not found</h1><p><a href='#/'>Home</a></p>"; }

  // ---------- router ----------
  function route() {
    document.getElementById("nav").classList.remove("open");
    var h = location.hash.replace(/^#\/?/, "").split("?")[0];
    var parts = h.split("/");
    if (!h) return pageHome();
    if (parts[0] === "guide") return pageGuide(parts[1]);
    if (parts[0] === "parts") return pageParts();
    if (parts[0] === "identify") return pageIdentify();
    if (parts[0] === "settings") return pageSettings();
    pageNotFound();
  }

  document.getElementById("menuBtn").onclick = function () { $nav.classList.toggle("open"); };
  window.addEventListener("hashchange", route);
  Promise.all([getJSON("content/sections.json"), getJSON("data/parts.json")]).then(function (r) {
    state.sections = r[0]; state.parts = r[1];
    state.parts.forEach(function (p) { state.partsById[p.id] = p; });
    route();
  }).catch(function (e) {
    $main.innerHTML = '<div class="err">Failed to load guide data: ' + esc(e.message) +
      ". If you opened index.html directly, serve the folder instead (e.g. <code>python3 -m http.server</code>).</div>";
  });
})();
