const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/parsed/web-entries.json')));
const embeddedData = JSON.stringify(data);

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>האנציקלופדיה של הרעיונות</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'David', 'FrankRuehl', 'Times New Roman', serif;
      background: #f5f0e8;
      color: #1a1a1a;
      height: 100vh;
      display: flex;
      overflow: hidden;
    }

    /* ── Sidebar ── */
    #sidebar {
      width: 290px;
      flex-shrink: 0;
      background: #2c2416;
      color: #e8dfc8;
      display: flex;
      flex-direction: column;
      border-left: 3px solid #8b6914;
    }

    #sidebar-header {
      padding: 18px 14px 12px;
      border-bottom: 1px solid #4a3a20;
      flex-shrink: 0;
    }

    #sidebar-header h1 { font-size: 0.95rem; font-weight: normal; color: #d4a84b; margin-bottom: 10px; line-height: 1.5; }

    #search {
      width: 100%; padding: 7px 10px;
      background: #1a1408; border: 1px solid #5a4820;
      color: #e8dfc8; border-radius: 4px;
      font-size: 0.9rem; font-family: inherit; direction: rtl;
    }
    #search::placeholder { color: #7a6840; }
    #search:focus { outline: none; border-color: #d4a84b; }

    #mode-tabs { display: flex; flex-direction: column; gap: 5px; margin: 10px 0; }
    .mode-tab-row { display: flex; gap: 4px; }
    .mode-tab-row .mode-tab { flex: 1 1 0; }
    .mode-tab {
      padding: 5px 4px; font-size: 0.72rem; font-family: inherit;
      background: #1a1408; border: 1px solid #5a4820; color: #a08040;
      border-radius: 4px; cursor: pointer; transition: all 0.1s; text-align: center;
      display: flex; align-items: center; justify-content: center;
    }
    .mode-tab-main {
      width: 100%; padding: 9px 4px; font-size: 0.92rem; font-weight: bold;
    }
    .mode-tab:hover { color: #d4a84b; border-color: #8b6914; }
    .mode-tab.active { background: #5a4010; color: #d4a84b; border-color: #d4a84b; }
    .mode-tab[data-mode="discipline"].active { background: #2e3c20; color: #8ab860; border-color: #8ab860; }
    .mode-tab[data-mode="emotion"].active    { background: #3c2432; color: #c088a0; border-color: #c088a0; }
    .mode-tab[data-mode="person"].active     { background: #1c2e3a; color: #7ba8c8; border-color: #7ba8c8; }
    .mode-tab[data-mode="work"].active       { background: #3c2e14; color: #c8a060; border-color: #c8a060; }

    .mode-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      margin-inline-end: 6px; flex: none; vertical-align: middle;
    }
    .mode-dot[data-dot="entries"]    { background: #d4a84b; }
    .mode-dot[data-dot="discipline"] { background: #8ab860; }
    .mode-dot[data-dot="emotion"]    { background: #c088a0; }
    .mode-dot[data-dot="person"]     { background: #7ba8c8; }
    .mode-dot[data-dot="work"]       { background: #c8a060; }

    #entry-count { font-size: 0.73rem; color: #7a6840; margin-top: 6px; text-align: center; }

    #category-matches { padding: 10px 14px 0; }
    #category-matches:empty { display: none; padding: 0; }
    #category-matches .cat-match-label { font-size: 0.68rem; color: #7a6840; margin-bottom: 6px; }
    #category-matches .tags-row { margin: 0 0 12px; gap: 5px; padding-bottom: 12px; border-bottom: 1px solid #3a2c14; }
    #category-matches .tag { font-size: 0.74rem; padding: 2px 9px; }
    .cat-match-count { font-size: 0.66rem; opacity: 0.65; margin-inline-start: 2px; }
    .cat-match-toggle {
      display: inline-block; align-self: center; font-size: 0.7rem; color: #a08040;
      cursor: pointer; text-decoration: underline; padding: 2px 4px;
    }
    .cat-match-toggle:hover { color: #d4a84b; }
    .cat-count { font-size: 0.7rem; color: #7a6840; margin-top: 2px; }
    .cat-back { cursor: pointer; text-decoration: underline; }
    .cat-back:hover { color: #d4a84b; }

    #entry-list { flex: 1; overflow-y: auto; padding: 4px 0; }
    #entry-list::-webkit-scrollbar { width: 6px; }
    #entry-list::-webkit-scrollbar-track { background: #1a1408; }
    #entry-list::-webkit-scrollbar-thumb { background: #5a4820; border-radius: 3px; }

    .entry-item {
      padding: 9px 14px; cursor: pointer;
      border-bottom: 1px solid #3a2c14; transition: background 0.1s;
    }
    .entry-item:hover { background: #3a2c14; }
    .entry-item.active { background: #5a4010; border-right: 3px solid #d4a84b; padding-right: 11px; }
    .entry-item .he-title { font-size: 0.95rem; color: #e8dfc8; line-height: 1.3; }
    .entry-item .en-title { font-size: 0.73rem; color: #a08040; margin-top: 2px; direction: ltr; text-align: right; }
    .entry-item.title-match .he-title { color: #fffdf2; font-weight: bold; }

    /* ── Main ── */
    #main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
    #main::-webkit-scrollbar { width: 8px; }
    #main::-webkit-scrollbar-track { background: #ece7db; }
    #main::-webkit-scrollbar-thumb { background: #b8a070; border-radius: 4px; }

    #content { max-width: 820px; width: 100%; margin: 0 auto; padding: 36px 40px 60px; }

    #placeholder {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: #a09060; font-size: 1.1rem;
      flex-direction: column; gap: 10px;
    }
    #placeholder .aleph { font-size: 5rem; color: #c8b080; line-height: 1; }

    .entry-image { margin-bottom: 22px; }
    .entry-image img {
      max-width: 100%; max-height: 360px; display: block;
      border: 1px solid #d4b870; border-radius: 4px;
      margin: 0 auto;
    }

    .entry-header { border-bottom: 2px solid #8b6914; padding-bottom: 18px; margin-bottom: 26px; }
    .entry-title-he { font-size: 2rem; font-weight: bold; color: #2c1a00; line-height: 1.3; }
    .entry-meta { display: flex; gap: 12px; align-items: baseline; margin-top: 8px; flex-wrap: wrap; }
    .entry-title-en { font-size: 1.05rem; color: #6b4e00; font-style: italic; direction: ltr; }
    .entry-authors { font-size: 0.82rem; color: #5a3a00; }
    .entry-word-count { font-size: 0.78rem; color: #9a8040; }

    .section-label {
      font-size: 0.68rem; font-weight: bold; letter-spacing: 0.12em;
      text-transform: uppercase; color: #8b6914;
      margin-bottom: 10px; border-bottom: 1px solid #d4b870; padding-bottom: 4px;
    }

    .brief-text {
      font-size: 1.05rem; font-weight: bold; line-height: 1.5; color: #1a1208;
      text-align: justify; margin-bottom: 24px;
      direction: rtl; unicode-bidi: plaintext;
      border-right: 3px solid #c8a840; padding-right: 14px;
    }

    .quotes { margin-bottom: 28px; display: flex; flex-direction: column; gap: 10px; }
    .quote-item {
      background: #ede5cc; border-right: 4px solid #8b6914;
      border-radius: 0 6px 6px 0; padding: 12px 16px;
    }
    .quote-text {
      font-size: 0.95rem; font-style: italic; color: #3a2800;
      line-height: 1.35; direction: rtl; unicode-bidi: plaintext;
      white-space: pre-line;
    }
    .quote-source {
      font-size: 0.78rem; color: #8b6914; margin-top: 6px;
      direction: rtl; unicode-bidi: plaintext;
    }
    .quote-source::before { content: '— '; }

    .body-text {
      font-size: 1.05rem; line-height: 1.55; color: #1a1208;
      text-align: justify; margin-bottom: 32px;
      direction: rtl; unicode-bidi: plaintext;
    }
    .body-text strong { font-weight: bold; color: #4a3000; }
    .body-text p { margin-bottom: 1.1em; }
    .body-text ul, .body-text ol { margin: 0 0 1.1em; padding-right: 1.6em; }
    .body-text li { margin-bottom: 0.4em; }
    .body-text > *:last-child { margin-bottom: 0; }

    .inline-link {
      color: #5a3a00; text-decoration: none;
      border-bottom: 1px solid #c8a840;
      cursor: pointer; transition: background 0.1s;
    }
    .inline-link:hover { background: #ecdfb8; }
    .inline-link.external {
      color: #6b6048; border-bottom: 1px dotted #a89868;
    }
    .inline-link.external:hover { background: #e8e2d2; }

    .tags-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
    .tag {
      padding: 3px 10px; border-radius: 12px; font-size: 0.82rem; cursor: pointer;
      transition: opacity 0.1s;
    }
    .tag:hover { opacity: 0.8; }
    .tag.discipline { background: #d4e8c0; border: 1px solid #8ab860; color: #2a4a10; }
    .tag.emotion    { background: #e8d0e0; border: 1px solid #c088a0; color: #5a1840; }
    .tag.person     { background: #cfe0ec; border: 1px solid #7ba8c8; color: #16384a; }
    .tag.work       { background: #f0ddb8; border: 1px solid #c8a060; color: #5a3810; }
    .tag.xref       { background: #e8d8a0; border: 1px solid #c8a840; color: #5a3a00; }
    .cat-active-value { cursor: pointer; padding: 2px 9px; font-size: 0.78rem; }

    .list-mode-breadcrumb {
      font-size: 0.85rem; color: #8b6914; margin-bottom: 22px;
      padding-bottom: 12px; border-bottom: 2px solid #8b6914;
      direction: rtl; unicode-bidi: plaintext;
    }
    .list-mode-item {
      padding: 12px 6px; cursor: pointer;
      border-bottom: 1px solid #d4b870; transition: background 0.1s;
    }
    .list-mode-item:hover { background: #ede5cc; }
    .list-mode-item .he-title { font-size: 1.05rem; color: #2c1a00; line-height: 1.3; }
    .list-mode-item .en-title { font-size: 0.8rem; color: #8b6914; margin-top: 2px; direction: ltr; text-align: right; }

    .bibliography { margin-bottom: 28px; background: #f0ece0; border: 1px solid #d4b870; border-radius: 6px; padding: 16px 18px; }
    .bib-item { font-size: 0.74rem; color: #3a2800; line-height: 1.5; padding: 2px 0; }
    .bib-item.ltr { direction: ltr; text-align: left; }
    .bib-item.rtl { direction: rtl; }

    .image-source { font-size: 0.78rem; color: #8b6914; margin-top: 8px; direction: rtl; unicode-bidi: plaintext; }
    .source-link { font-size: 0.78rem; color: #8b6914; margin-top: 20px; }
    .source-link a { color: #8b6914; }

    @media (max-width: 680px) {
      body { flex-direction: column; height: auto; overflow: auto; }
      #sidebar { width: 100%; height: auto; border-left: none; border-bottom: 3px solid #8b6914; }
      #entry-list { max-height: 200px; }
      #main { overflow: visible; }
    }
  </style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-header">
    <h1>האנציקלופדיה של הרעיונות<br><span style="font-size:0.78rem;color:#a08040">haraayonot.com</span></h1>
    <div id="mode-tabs">
      <button class="mode-tab mode-tab-main active" data-mode="entries" onclick="setBrowseMode('entries')">
        <span class="mode-dot" data-dot="entries"></span>ערכים
      </button>
      <div class="mode-tab-row">
        <button class="mode-tab" data-mode="discipline" onclick="setBrowseMode('discipline')"><span class="mode-dot" data-dot="discipline"></span>תחומים</button>
        <button class="mode-tab" data-mode="emotion" onclick="setBrowseMode('emotion')"><span class="mode-dot" data-dot="emotion"></span>רגשות</button>
        <button class="mode-tab" data-mode="person" onclick="setBrowseMode('person')"><span class="mode-dot" data-dot="person"></span>אישים</button>
        <button class="mode-tab" data-mode="work" onclick="setBrowseMode('work')"><span class="mode-dot" data-dot="work"></span>יצירות</button>
      </div>
    </div>
    <input id="search" type="search" placeholder="חיפוש ערך..." oninput="onSearchInput(this.value)">
    <div id="entry-count"></div>
  </div>
  <div id="category-matches"></div>
  <div id="entry-list"></div>
</div>

<div id="main">
  <div id="placeholder">
    <span class="aleph">א</span>
    <span>בחר ערך מהרשימה</span>
  </div>
  <div id="content" style="display:none"></div>
</div>

<script>
const ENTRIES = ${embeddedData};

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

var ENTRY_BY_SLUG = {};
ENTRIES.forEach(function(e) { ENTRY_BY_SLUG[e.slug] = e; });

function renderSegments(segments) {
  return segments.map(function(seg) {
    var inner;
    if (seg.href && seg.slug && ENTRY_BY_SLUG[seg.slug]) {
      inner = '<a class="inline-link" href="#" data-slug="' + esc(seg.slug) +
        '" onclick="showEntry(this.dataset.slug);return false;">' + esc(seg.text) + '</a>';
    } else if (seg.href) {
      inner = '<a class="inline-link external" href="' + esc(seg.href) +
        '" target="_blank" rel="noopener">' + esc(seg.text) + '</a>';
    } else {
      inner = esc(seg.text);
    }
    return seg.bold ? '<strong>' + inner + '</strong>' : inner;
  }).join('');
}

function isEnglishLine(s) {
  if (!s) return false;
  var latin = (s.match(/[a-zA-Z]/g)||[]).length;
  var hebrew = (s.match(/[\\u05D0-\\u05EA]/g)||[]).length;
  return latin > hebrew && latin > 3;
}

var CATEGORY_FIELD = { discipline: 'disciplines', emotion: 'emotions', person: 'people', work: 'works' };
var CATEGORY_LABEL = { discipline: 'תחומים', emotion: 'רגשות', person: 'אישים', work: 'יצירות' };

function buildCategoryIndex(field) {
  var map = {};
  ENTRIES.forEach(function(e) {
    (e[field] || []).forEach(function(v) {
      (map[v] = map[v] || []).push(e);
    });
  });
  return map;
}

var CATEGORY_INDEX = {};
Object.keys(CATEGORY_FIELD).forEach(function(type) {
  CATEGORY_INDEX[type] = buildCategoryIndex(CATEGORY_FIELD[type]);
});

var browseMode = 'entries';   // 'entries' | 'discipline' | 'emotion' | 'person'
var activeCategory = null;    // { type, value } once drilled into a specific tag

let currentId = null;
let filtered = ENTRIES.slice();

function renderList(items, query) {
  query = (query || '').trim();
  var lq = query.toLowerCase();
  document.getElementById('entry-count').innerHTML =
    '<span class="mode-dot" data-dot="entries"></span>' + items.length + ' ערכים';
  document.getElementById('entry-list').innerHTML = items.map(function(e) {
    var titleMatch = query && (
      (e.title_he && e.title_he.includes(query)) ||
      (e.title_en && e.title_en.toLowerCase().includes(lq))
    );
    return '<div class="entry-item' + (e.slug === currentId ? ' active' : '') + (titleMatch ? ' title-match' : '') +
      '" data-id="' + esc(e.slug) + '" onclick="showEntry(this.dataset.id)">' +
      '<div class="he-title">' + esc(e.title_he) + '</div>' +
      (e.title_en ? '<div class="en-title">' + esc(e.title_en) + '</div>' : '') +
      '</div>';
  }).join('');
}

var CATEGORY_FIELDS = Object.keys(CATEGORY_FIELD).map(function(t) { return CATEGORY_FIELD[t]; });

function entryCategoryMatch(e, q) {
  if ((e.cross_refs || []).some(function(v) { return v.includes(q); })) return true;
  return CATEGORY_FIELDS.some(function(field) {
    return (e[field] || []).some(function(v) { return v.includes(q); });
  });
}

function entryMatchRank(e, q, lq) {
  var titleHe = e.title_he || '';
  var titleEn = (e.title_en || '').toLowerCase();
  if (titleHe.startsWith(q) || titleEn.startsWith(lq)) return 0;
  if (titleHe.includes(q) || titleEn.includes(lq)) return 1;
  if (entryCategoryMatch(e, q)) return 2;
  if (e.body_he && e.body_he.includes(q)) return 3;
  return -1;
}

function renderCategoryMatches(query) {
  var container = document.getElementById('category-matches');
  if (!query) { container.innerHTML = ''; return; }
  var matches = [];
  Object.keys(CATEGORY_FIELD).forEach(function(type) {
    var index = CATEGORY_INDEX[type];
    Object.keys(index).forEach(function(value) {
      if (value.includes(query)) {
        matches.push({
          type: type, value: value, count: index[value].length,
          rank: value.startsWith(query) ? 0 : 1
        });
      }
    });
  });
  if (!matches.length) { container.innerHTML = ''; return; }
  matches.sort(function(a, b) {
    return a.rank - b.rank || b.count - a.count || a.value.localeCompare(b.value, 'he');
  });
  container.innerHTML =
    '<div class="cat-match-label">קטגוריות תואמות</div><div class="tags-row" id="cat-match-tags">' +
    matches.slice(0, 40).map(function(m) {
      return '<span class="tag ' + esc(m.type) + '" data-type="' + esc(m.type) + '" data-value="' + esc(m.value) +
        '" onclick="showCategoryFromTag(this.dataset.type, this.dataset.value)">' +
        esc(m.value) + ' <span class="cat-match-count">' + m.count + '</span></span>';
    }).join('') +
    '<span class="cat-match-toggle" id="cat-match-toggle" onclick="toggleCategoryMatches()" style="display:none">עוד</span>' +
    '</div>';

  // Keep at most 3 visual rows — however many chips fit depends on sidebar width,
  // so trim by measuring actual layout rather than guessing a fixed chip count.
  // Anything beyond that is reachable via the "עוד" toggle.
  var chips = document.querySelectorAll('#cat-match-tags .tag');
  var toggle = document.getElementById('cat-match-toggle');
  var rowTops = [];
  var overflowStart = -1;
  for (var i = 0; i < chips.length; i++) {
    var top = chips[i].offsetTop;
    if (rowTops.indexOf(top) === -1) rowTops.push(top);
    if (rowTops.length > 3 && overflowStart === -1) overflowStart = i;
  }
  if (overflowStart === -1) {
    toggle.style.display = 'none';
  } else {
    for (var j = overflowStart; j < chips.length; j++) {
      chips[j].classList.add('cat-match-extra');
      chips[j].style.display = 'none';
    }
    toggle.style.display = '';
    toggle.textContent = 'עוד';
    toggle.dataset.expanded = 'false';
  }
}

function toggleCategoryMatches() {
  var toggle = document.getElementById('cat-match-toggle');
  var expand = toggle.dataset.expanded !== 'true';
  document.querySelectorAll('#cat-match-tags .cat-match-extra').forEach(function(c) {
    c.style.display = expand ? '' : 'none';
  });
  toggle.textContent = expand ? 'פחות' : 'עוד';
  toggle.dataset.expanded = expand ? 'true' : 'false';
}

function filterEntries(q) {
  q = q.trim();
  if (!q) {
    filtered = ENTRIES.slice();
  } else {
    var lq = q.toLowerCase();
    filtered = ENTRIES
      .map(function(e) { return { entry: e, rank: entryMatchRank(e, q, lq) }; })
      .filter(function(r) { return r.rank !== -1; })
      .sort(function(a, b) { return a.rank - b.rank; })
      .map(function(r) { return r.entry; });
  }
  renderCategoryMatches(q);
  renderList(filtered, q);
}

function onSearchInput(q) {
  if (browseMode === 'entries') {
    filterEntries(q);
  } else if (activeCategory) {
    renderCategoryEntryList(activeCategory.type, activeCategory.value, q);
  } else {
    renderCategoryValueList(browseMode, q);
  }
}

function setBrowseMode(mode) {
  var search = document.getElementById('search');
  // Going back to "ערכים" carries over whatever you were searching; switching
  // forward into a category starts that search fresh.
  var q = (mode === 'entries') ? search.value.trim() : '';
  browseMode = mode;
  activeCategory = null;
  document.querySelectorAll('.mode-tab').forEach(function(b) {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  search.value = q;
  search.placeholder = mode === 'entries' ? 'חיפוש ערך...' : 'חיפוש ב' + CATEGORY_LABEL[mode] + '...';
  if (mode === 'entries') {
    filterEntries(q);
  } else {
    document.getElementById('category-matches').innerHTML = '';
    renderCategoryValueList(mode, q);
  }
}

function renderCategoryValueList(type, query) {
  query = (query || '').trim();
  var index = CATEGORY_INDEX[type];
  var values = Object.keys(index);
  if (query) {
    values = values.filter(function(v) { return v.includes(query); });
  }
  values.sort(function(a, b) {
    return index[b].length - index[a].length || a.localeCompare(b, 'he');
  });
  filtered = [];
  document.getElementById('entry-count').innerHTML =
    '<span class="mode-dot" data-dot="' + esc(type) + '"></span>' + values.length + ' ' + esc(CATEGORY_LABEL[type]);
  document.getElementById('entry-list').innerHTML = values.map(function(v) {
    return '<div class="entry-item" data-type="' + esc(type) + '" data-value="' + esc(v) +
      '" onclick="openCategory(this.dataset.type, this.dataset.value)">' +
      '<div class="he-title">' + esc(v) + '</div>' +
      '<div class="cat-count">' + index[v].length + ' ערכים</div>' +
      '</div>';
  }).join('');
}

function openCategory(type, value) {
  activeCategory = { type: type, value: value };
  document.getElementById('search').value = '';
  renderCategoryEntryList(type, value, '');
}

function renderCategoryEntryList(type, value, query) {
  query = (query || '').trim();
  var lq = query.toLowerCase();
  var items = (CATEGORY_INDEX[type][value] || []).filter(function(e) {
    return !query || (e.title_he && e.title_he.includes(query)) ||
           (e.title_en && e.title_en.toLowerCase().includes(lq));
  });
  filtered = items.slice();
  document.getElementById('entry-count').innerHTML =
    '<span class="mode-dot" data-dot="' + esc(type) + '"></span>' +
    '<span class="cat-back" onclick="backToCategoryList()">⟵ ' + esc(CATEGORY_LABEL[type]) + '</span> · ' +
    '<span class="tag ' + esc(type) + ' cat-active-value" data-type="' + esc(type) + '" data-value="' + esc(value) +
      '" onclick="showCategoryListMode(this.dataset.type, this.dataset.value)">' + esc(value) + '</span>' +
    ' (' + items.length + ')';
  document.getElementById('entry-list').innerHTML = items.map(function(e) {
    return '<div class="entry-item' + (e.slug === currentId ? ' active' : '') +
      '" data-id="' + esc(e.slug) + '" onclick="showEntry(this.dataset.id)">' +
      '<div class="he-title">' + esc(e.title_he) + '</div>' +
      (e.title_en ? '<div class="en-title">' + esc(e.title_en) + '</div>' : '') +
      '</div>';
  }).join('');
}

function backToCategoryList() {
  activeCategory = null;
  // Carry over whatever was typed while drilled in — no need to retype it.
  var q = document.getElementById('search').value.trim();
  renderCategoryValueList(browseMode, q);
}

function showCategoryFromTag(type, value) {
  browseMode = type;
  document.querySelectorAll('.mode-tab').forEach(function(b) {
    b.classList.toggle('active', b.dataset.mode === type);
  });
  var search = document.getElementById('search');
  search.value = '';
  search.placeholder = 'חיפוש ב' + CATEGORY_LABEL[type] + '...';
  document.getElementById('category-matches').innerHTML = '';
  openCategory(type, value);
}

function showCategoryListMode(type, value) {
  currentId = null;
  document.querySelectorAll('.entry-item').forEach(function(el) { el.classList.remove('active'); });

  var items = CATEGORY_INDEX[type][value] || [];
  var html = '<div class="list-mode-breadcrumb">ערכים&gt;' + esc(CATEGORY_LABEL[type]) + '&gt;' + esc(value) + '</div>' +
    items.map(function(e) {
      return '<div class="list-mode-item" data-id="' + esc(e.slug) + '" onclick="showEntry(this.dataset.id)">' +
        '<div class="he-title">' + esc(e.title_he) + '</div>' +
        (e.title_en ? '<div class="en-title">' + esc(e.title_en) + '</div>' : '') +
        '</div>';
    }).join('');

  var content = document.getElementById('content');
  document.getElementById('placeholder').style.display = 'none';
  content.style.display = 'block';
  content.innerHTML = html;
  document.getElementById('main').scrollTop = 0;
}

function showEntry(id) {
  var entry = ENTRIES.find(function(e) { return e.slug === id; });
  if (!entry) return;
  currentId = id;

  document.querySelectorAll('.entry-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.id === id);
  });

  var html = '';

  if (entry.image && entry.image.src) {
    html += '<div class="entry-image">' +
      '<img src="' + esc(entry.image.src) + '" alt="' + esc(entry.title_he) + '" loading="lazy">' +
      '</div>';
  }

  html += '<div class="entry-header">' +
    '<div class="entry-title-he">' + esc(entry.title_he) + '</div>' +
    '<div class="entry-meta">' +
    (entry.title_en ? '<span class="entry-title-en">' + esc(entry.title_en) + '</span>' : '') +
    (entry.authors && entry.authors.length ? '<span class="entry-authors">מאת: ' + esc(entry.authors.join(', ')) + '</span>' : '') +
    (entry.word_count ? '<span class="entry-word-count">' + entry.word_count + ' מילים</span>' : '') +
    '</div></div>';

  if (entry.disciplines && entry.disciplines.length) {
    html += '<div class="section-label">תחומים</div><div class="tags-row">' +
      entry.disciplines.map(function(d) {
        return '<span class="tag discipline" data-type="discipline" data-value="' + esc(d) +
          '" onclick="showCategoryFromTag(this.dataset.type, this.dataset.value)">' + esc(d) + '</span>';
      }).join('') + '</div>';
  }

  if (entry.brief_he) {
    html += '<div class="section-label">תקציר</div>' +
      '<div class="brief-text">' + esc(entry.brief_he) + '</div>';
  }

  if (entry.quotes && entry.quotes.length) {
    html += '<div class="section-label">פתיחה במובאות</div><div class="quotes">' +
      entry.quotes.map(function(q) {
        return '<div class="quote-item">' +
          '<div class="quote-text">' + esc(q.text) + '</div>' +
          (q.source ? '<div class="quote-source">' + esc(q.source) + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
  }

  if (entry.body_blocks && entry.body_blocks.length) {
    html += '<div class="section-label">ערך</div><div class="body-text">' +
      entry.body_blocks.map(function(block) {
        if (block.type === 'list') {
          return '<ul>' + block.items.map(function(segs) {
            return '<li>' + renderSegments(segs) + '</li>';
          }).join('') + '</ul>';
        }
        return '<p>' + renderSegments(block.segments) + '</p>';
      }).join('') + '</div>';
  } else if (entry.body_he) {
    html += '<div class="section-label">ערך</div>' +
      '<div class="body-text"><p>' + esc(entry.body_he) + '</p></div>';
  }

  if (entry.cross_refs && entry.cross_refs.length) {
    html += '<div class="section-label">ראו גם</div><div class="tags-row">' +
      entry.cross_refs.slice(0, 20).map(function(r) {
        return '<span class="tag xref" data-ref="' + esc(r) + '" onclick="searchRef(this.dataset.ref)">' + esc(r) + '</span>';
      }).join('') + '</div>';
  }

  if (entry.emotions && entry.emotions.length) {
    html += '<div class="section-label">רגשות</div><div class="tags-row">' +
      entry.emotions.map(function(em) {
        return '<span class="tag emotion" data-type="emotion" data-value="' + esc(em) +
          '" onclick="showCategoryFromTag(this.dataset.type, this.dataset.value)">' + esc(em) + '</span>';
      }).join('') + '</div>';
  }

  if (entry.works && entry.works.length) {
    html += '<div class="section-label">יצירות</div><div class="tags-row">' +
      entry.works.map(function(w) {
        return '<span class="tag work" data-type="work" data-value="' + esc(w) +
          '" onclick="showCategoryFromTag(this.dataset.type, this.dataset.value)">' + esc(w) + '</span>';
      }).join('') + '</div>';
  }

  if (entry.people && entry.people.length) {
    html += '<div class="section-label">אישים</div><div class="tags-row">' +
      entry.people.map(function(p) {
        return '<span class="tag person" data-type="person" data-value="' + esc(p) +
          '" onclick="showCategoryFromTag(this.dataset.type, this.dataset.value)">' + esc(p) + '</span>';
      }).join('') + '</div>';
  }

  if (entry.bibliography && entry.bibliography.length) {
    html += '<div class="bibliography"><div class="section-label">מקורות</div>' +
      entry.bibliography.map(function(b) {
        var en = isEnglishLine(b);
        return '<div class="bib-item ' + (en ? 'ltr' : 'rtl') + '">' + esc(b) + '</div>';
      }).join('') + '</div>';
  }

  if (entry.image && entry.image.caption) {
    html += '<div class="image-source">מקור התמונה: ' + esc(entry.image.caption) + '</div>';
  }

  html += '<div class="source-link">מקור: <a href="' + esc(entry.url) + '" target="_blank">' + esc(entry.url) + '</a></div>';

  var content = document.getElementById('content');
  document.getElementById('placeholder').style.display = 'none';
  content.style.display = 'block';
  content.innerHTML = html;
  document.getElementById('main').scrollTop = 0;
}

function searchRef(term) {
  var input = document.getElementById('search');
  input.value = term;
  filterEntries(term);
}

renderList(ENTRIES);

document.addEventListener('keydown', function(e) {
  if (!currentId) { if (filtered.length > 0) showEntry(filtered[0].slug); return; }
  var idx = filtered.findIndex(function(en) { return en.slug === currentId; });
  if (e.key === 'ArrowDown' && idx < filtered.length - 1) { e.preventDefault(); showEntry(filtered[idx+1].slug); scrollActiveIntoView(); }
  else if (e.key === 'ArrowUp' && idx > 0) { e.preventDefault(); showEntry(filtered[idx-1].slug); scrollActiveIntoView(); }
});

function scrollActiveIntoView() {
  var el = document.querySelector('.entry-item.active');
  if (el) el.scrollIntoView({ block: 'nearest' });
}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '../web-viewer.html'), html);
console.log('web-viewer.html written (' + Math.round(html.length / 1024) + ' KB)');
