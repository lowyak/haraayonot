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
  var hebrew = (s.match(/[\u05D0-\u05EA]/g)||[]).length;
  return latin > hebrew && latin > 3;
}

// Cross-ref labels are the wording an in-body link used at the point it
// appeared (e.g. a plural or inflected form), not the title of the entry it
// links to - find that link in the entry's own body to recover the target.
function resolveCrossRef(entry, refText) {
  if (!entry.body_blocks) return null;
  for (var i = 0; i < entry.body_blocks.length; i++) {
    var block = entry.body_blocks[i];
    var segLists = block.type === 'list' ? block.items : [block.segments];
    for (var j = 0; j < segLists.length; j++) {
      var segs = segLists[j];
      if (!segs) continue;
      for (var k = 0; k < segs.length; k++) {
        var seg = segs[k];
        if (seg.href && seg.slug && (seg.text || '').trim() === refText && ENTRY_BY_SLUG[seg.slug]) {
          return ENTRY_BY_SLUG[seg.slug];
        }
      }
    }
  }
  return null;
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

function clearSearch() {
  var input = document.getElementById('search');
  input.value = '';
  input.focus();
  onSearchInput('');
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
  scrollSidebarToTopOnMobile();
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
        // The credit sits on the side opposite to where the quote itself
        // starts, mirroring its language direction (Hebrew quote -> right,
        // credit on the left; foreign-language quote -> left, credit on the right).
        var sourceAlign = isEnglishLine(q.text) ? 'align-right' : 'align-left';
        return '<div class="quote-item">' +
          '<div class="quote-text">' + esc(q.text) + '</div>' +
          (q.source ? '<div class="quote-source ' + sourceAlign + '">' + esc(q.source) + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
  }

  if (entry.body_blocks && entry.body_blocks.length) {
    html += '<div class="section-label">ערך</div><div class="body-text">' +
      entry.body_blocks.map(function(block) {
        if (block.type === 'list') {
          var listClass = block.style === 'lettered' ? ' class="lettered-list"' : '';
          return '<ul' + listClass + '>' + block.items.map(function(segs) {
            return '<li>' + renderSegments(segs) + '</li>';
          }).join('') + '</ul>';
        }
        if (block.type === 'poem') {
          // Same opposite-side alignment rule as quote credits, judged by
          // the poem's own language rather than the page's base direction.
          var creditAlign = isEnglishLine(block.lines.join(' ')) ? 'align-right' : 'align-left';
          return '<div class="poem">' +
            block.lines.map(function(line) { return esc(line) + '<br>'; }).join('') +
            (block.credit ? '<div class="poem-credit ' + creditAlign + '">' + esc(block.credit) + '</div>' : '') +
            '</div>';
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
        var target = resolveCrossRef(entry, r);
        if (target) {
          return '<span class="tag xref" data-slug="' + esc(target.slug) +
            '" onclick="showEntry(this.dataset.slug)">' + esc(target.title_he) + '</span>';
        }
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
  if (isMobileLayout()) {
    // On the stacked mobile layout #main no longer scrolls on its own — the
    // page does — so land on the entry's own start (its image) rather than
    // wherever the previous article happened to leave the scroll position.
    content.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    document.getElementById('main').scrollTop = 0;
  }
}

function searchRef(term) {
  var input = document.getElementById('search');
  input.value = term;
  filterEntries(term);
  scrollSidebarToTopOnMobile();
}

renderList(ENTRIES);

document.addEventListener('keydown', function(e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (!currentId) { if (filtered.length > 0) showEntry(filtered[0].slug); return; }
  var idx = filtered.findIndex(function(en) { return en.slug === currentId; });
  if (e.key === 'ArrowDown' && idx < filtered.length - 1) { e.preventDefault(); showEntry(filtered[idx+1].slug); scrollActiveIntoView(); }
  else if (e.key === 'ArrowUp' && idx > 0) { e.preventDefault(); showEntry(filtered[idx-1].slug); scrollActiveIntoView(); }
});

function scrollActiveIntoView() {
  var el = document.querySelector('.entry-item.active');
  if (el) el.scrollIntoView({ block: 'nearest' });
}

function isMobileLayout() {
  return window.innerWidth <= 680;
}

function scrollSidebarToTopOnMobile() {
  // On the stacked mobile layout, jumping into a category or "ראו גם" ref
  // from within an entry should bring the sidebar — title included — back
  // into view rather than leaving the user scrolled into #main.
  if (isMobileLayout()) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
