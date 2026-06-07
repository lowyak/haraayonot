"""
web_extractor.py
Scrapes encyclopedia entries from haraayonot.com.
"""

import requests
import json
import re
import sys
import time
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString

BASE_URL = 'https://haraayonot.com'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; encyclopedia-parser/1.0)'}

IDEA_HREF = re.compile(r'/idea/([^/]+)/?')

LEADING_DASH = re.compile(r'^[–—-]\s+(\S.*)$')


def clean_title_en(t):
    """Undo a bidi text-entry glitch on the source site where a trailing
    bracket/dash in an English title gets stored shifted to the front, e.g.
    '(Other (Auture' (should read 'Other (Autre)') or '– Inter' (should read
    'Inter-', matching the Hebrew prefix form 'אינטר-'). Only triggers on the
    specific shifted-punctuation shape, so well-formed titles like
    'Object (Petit) a' pass through untouched.
    """
    if not t:
        return t
    t = t.strip()
    if t.startswith('(') and t.count('(') > t.count(')'):
        rest = t[1:].lstrip()
        if rest.count('(') > rest.count(')'):
            rest += ')'
        return rest
    m = LEADING_DASH.match(t)
    if m and '(' not in t and ')' not in t:
        return m.group(1) + '-'
    return t


def paragraph_segments(p):
    """Break a paragraph into plain-text and link segments so the viewer can
    render cross-reference links as clickable, in-place navigation, and bold
    sub-headers (<strong>/<b>, e.g. in אופנה) as bold text.
    A segment is {'text': ...}, optionally with 'href'+'slug' for entry links
    or 'bold': True for emphasized sub-header text. Links keep whatever
    bold/italic styling the site applies to them via CSS, not via these tags,
    so a link is never marked 'bold' here.
    """
    segments = []

    def walk(node, bold):
        if isinstance(node, NavigableString):
            text = str(node)
            if text:
                seg = {'text': text}
                if bold:
                    seg['bold'] = True
                segments.append(seg)
        elif node.name == 'a' and node.get('href'):
            text = node.get_text()
            if not text:
                return
            seg = {'text': text, 'href': node['href']}
            m = IDEA_HREF.search(node['href'])
            if m:
                seg['slug'] = m.group(1)
            segments.append(seg)
        elif node.name in ('strong', 'b'):
            for child in node.children:
                walk(child, bold=True)
        elif node.name in ('em', 'i', 'span'):
            for child in node.children:
                walk(child, bold=bold)
        else:
            text = node.get_text()
            if text:
                seg = {'text': text}
                if bold:
                    seg['bold'] = True
                segments.append(seg)

    for node in p.children:
        walk(node, bold=False)
    return segments


def get_soup(url):
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    r.encoding = 'utf-8'
    return BeautifulSoup(r.text, 'html.parser')


def get_letter_filters():
    """Discover the Hebrew letter -> taxonomy id mapping used by the
    alphabetic index's letter filter (a.letter[href*="?letter="]),
    in the order the letters appear on the page (alphabetical).
    The ids are arbitrary WordPress term ids, not sequential, so they
    must be read off the page rather than guessed.
    """
    soup = get_soup(f'{BASE_URL}/alphabetic-ideas/')
    filters = []
    seen = set()
    for a in soup.select('a.letter[href*="letter="]'):
        m = re.search(r'letter=(\d+)', a['href'])
        letter = a.get_text(strip=True)
        if m and letter and letter not in seen:
            seen.add(letter)
            filters.append((letter, m.group(1)))
    return filters


def get_entry_urls_for_page(soup):
    seen = set()
    links = []
    # Each entry card has an h3.entry-title; the first <a> inside it is the entry link
    for h3 in soup.select('h3.entry-title'):
        a = h3.find('a', href=True)
        if a and '/idea/' in a['href']:
            href = a['href']
            if href not in seen:
                seen.add(href)
                links.append(href)
    return links


def get_entry_urls_alphabetic(limit=None, offset=0):
    """Return entry URLs in alphabetical order by walking the alphabetic
    index letter by letter (the index page is letter-filtered and defaults
    to the first letter only, so each letter must be fetched via ?letter=id).
    Stops fetching once enough links are collected to satisfy offset+limit.
    """
    links = []
    need = None if limit is None else offset + limit
    for letter, code in get_letter_filters():
        if need is not None and len(links) >= need:
            break
        page_soup = get_soup(f'{BASE_URL}/alphabetic-ideas/?letter={code}')
        for href in get_entry_urls_for_page(page_soup):
            if href not in links:
                links.append(href)

    if limit is not None:
        return links[offset:offset + limit]
    return links[offset:]


def get_creations():
    """Fetch the full list of 'creations' (works of art/literature/film/etc.
    referenced across entries) from the ideas-by-creations index. Each is a
    taxonomy term with its own archive page listing the ideas that cite it —
    unlike disciplines/emotions/people, these links don't appear on idea pages
    themselves, so the association has to be built from the term archive pages.
    """
    soup = get_soup(f'{BASE_URL}/ideas-by-creations/')
    creations = []
    seen = set()
    for a in soup.select('#termidea-list li a[href*="/creation/"]'):
        href = a['href']
        name = a.get_text(strip=True)
        if href not in seen and name:
            seen.add(href)
            creations.append({'name': name, 'url': href})
    return creations


def get_creation_idea_slugs(url):
    soup = get_soup(url)
    slugs = []
    for a in soup.select('article.list-entry h3.entry-title a[href*="/idea/"]'):
        m = IDEA_HREF.search(a['href'])
        if m and m.group(1) not in slugs:
            slugs.append(m.group(1))
    return slugs


def scrape_works(out_path, delay=0.5, limit=None):
    """Build a slug -> [creation names] map by visiting every creation's
    archive page, then merge it into the existing entries file as a
    'works' field (mirrors disciplines/emotions/people).
    """
    print('Fetching creations index...', file=sys.stderr)
    creations = get_creations()
    if limit:
        creations = creations[:limit]
    print(f'Found {len(creations)} creations', file=sys.stderr)

    works_by_slug = {}
    for i, c in enumerate(creations):
        try:
            slugs = get_creation_idea_slugs(c['url'])
        except Exception as e:
            print(f'  [{i+1}/{len(creations)}] ERROR on {c["name"]}: {e}', file=sys.stderr)
            slugs = []
        for slug in slugs:
            works_by_slug.setdefault(slug, [])
            if c['name'] not in works_by_slug[slug]:
                works_by_slug[slug].append(c['name'])
        print(f'  [{i+1}/{len(creations)}] {c["name"]} -> {len(slugs)} ideas', file=sys.stderr)
        if delay and i < len(creations) - 1:
            time.sleep(delay)

    out_path = Path(out_path)
    with open(out_path, encoding='utf-8') as f:
        entries = json.load(f)

    updated = 0
    for e in entries:
        works = works_by_slug.get(e['slug'], [])
        if works != e.get('works', []):
            updated += 1
        e['works'] = works

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    with_works = sum(1 for e in entries if e['works'])
    print(f'\nUpdated works field on {updated} entries ({with_works} have at least one work) → {out_path}', file=sys.stderr)


def parse_entry(url):
    soup = get_soup(url)

    entry = {
        'url': url,
        'slug': url.rstrip('/').split('/')[-1],
        'title_he': None,
        'title_en': None,
        'authors': [],
        'image': None,
        'brief_he': '',
        'quotes': [],
        'body_he': '',
        'body_blocks': [],
        'cross_refs': [],
        'bibliography': [],
        'disciplines': [],
        'emotions': [],
        'people': [],
        'word_count': 0,
    }

    # ── Title ────────────────────────────────────────────────────────────────
    h1 = soup.find('h1')
    if h1:
        entry['title_he'] = h1.get_text(strip=True)

    h2 = soup.find('h2')
    if h2:
        t = h2.get_text(strip=True)
        # Only use as English title if it contains Latin characters
        if re.search(r'[a-zA-Z]', t):
            entry['title_en'] = clean_title_en(t)

    # ── Authors ───────────────────────────────────────────────────────────────
    # Author credit is in a link whose title contains "מאת:"
    for a in soup.find_all('a', title=True):
        if 'מאת:' in a.get('title', ''):
            # Extract author names after "מאת: "
            m = re.search(r'מאת:\s*(.+?)(?:\s*\(|$)', a['title'])
            if m:
                names = [n.strip() for n in m.group(1).split(',') if n.strip()]
                entry['authors'] = names
            break

    # ── Disciplines and Emotions ──────────────────────────────────────────────
    for a in soup.select('a[href*="/discipline/"]'):
        t = a.get_text(strip=True)
        if t:
            entry['disciplines'].append(t)

    for a in soup.select('a[href*="/emotion/"]'):
        t = a.get_text(strip=True)
        if t:
            entry['emotions'].append(t)

    # ── People mentioned ("אישים" tags, links to /people/<name>) ─────────────
    for a in soup.select('a[href*="/people/"]'):
        t = a.get_text(strip=True)
        if t:
            entry['people'].append(t)

    # ── Feature image + caption ───────────────────────────────────────────────
    img = soup.select_one('#idea-feature-image img')
    if img and img.get('src'):
        cap_el = soup.select_one('#tuhmb-cap')
        caption = ''
        if cap_el:
            caption = cap_el.get_text(separator=' ', strip=True)
            caption = re.sub(r'^תאור\s*/\s*מקור התמונה:\s*', '', caption).strip()
        if not caption:
            caption = (img.get('title') or '').strip()
        entry['image'] = {'src': img['src'], 'caption': caption}

    # ── Brief (the bold lead paragraph shown right under the title) ──────────
    abstract = soup.select_one('#abstract')
    if abstract:
        entry['brief_he'] = abstract.get_text(separator=' ', strip=True)

    # ── Quotes ────────────────────────────────────────────────────────────────
    # Each opening quote lives in its own div.quote, holding the quote text
    # plus a span.quote-ref with its source. The site's markup nests a stray
    # <p> inside the outer <p> here, which is what caused the duplication —
    # extracting from quote-ref-stripped text instead of generic <p> scanning
    # sidesteps that entirely.
    for q in soup.select('div.quote'):
        ref = q.select_one('.quote-ref')
        source = ref.get_text(strip=True) if ref else ''
        if ref:
            ref.extract()
        # Some quotes are poetry where line breaks (<br>) carry meaning;
        # turn them into '\n' before flattening so they survive into the text.
        for br in q.find_all('br'):
            br.replace_with('\n')
        raw = q.get_text()
        lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in raw.split('\n')]
        text = '\n'.join(line for line in lines if line)
        if text:
            entry['quotes'].append({'text': text, 'source': source})

    # ── Body: only #post-content blocks (excludes brief & quotes, so no
    #    duplication and no need to detect a bibliography marker). Walk direct
    #    children in order so in-text <ul>/<ol> lists aren't skipped — some
    #    entries (e.g. אופנה) define their content as bullet lists rather than
    #    plain paragraphs. ────────────────────────────────────────────────────
    post = soup.select_one('#post-content')
    body_parts = []
    body_blocks = []
    if post:
        for el in post.find_all(['p', 'ul', 'ol'], recursive=False):
            if el.name == 'p':
                text = el.get_text(separator=' ', strip=True)
                if text:
                    body_parts.append(text)
                    body_blocks.append({'type': 'p', 'segments': paragraph_segments(el)})
            else:
                items = []
                for li in el.find_all('li', recursive=False):
                    text = li.get_text(separator=' ', strip=True)
                    if text:
                        body_parts.append(text)
                        items.append(paragraph_segments(li))
                if items:
                    body_blocks.append({'type': 'list', 'items': items})
    entry['body_he'] = '\n\n'.join(body_parts)
    entry['body_blocks'] = body_blocks

    # ── Bibliography: Hebrew and English sources live in their own containers ─
    bib_parts = []
    for bib_id in ('#heb-bib', '#eng-bib'):
        bib = soup.select_one(bib_id)
        if not bib:
            continue
        for p in bib.find_all('p'):
            text = p.get_text(separator=' ', strip=True)
            if text:
                bib_parts.append(text)
    entry['bibliography'] = bib_parts

    # ── Cross-references: links to /idea/ within the entry body ──────────────
    cross_refs = []
    seen_refs = set()
    if post:
        for a in post.find_all('a', href=True):
            href = a['href']
            if '/idea/' in href and href.rstrip('/') != url.rstrip('/'):
                label = a.get_text(strip=True)
                if label and label not in seen_refs:
                    seen_refs.add(label)
                    cross_refs.append(label)
    entry['cross_refs'] = cross_refs

    entry['word_count'] = len(entry['body_he'].split())
    return entry


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=15,
                        help='Number of entries to fetch (alphabetic order)')
    parser.add_argument('--offset', type=int, default=0,
                        help='Skip this many entries before fetching (alphabetic order)')
    parser.add_argument('--out', default='data/parsed/web-entries.json')
    parser.add_argument('--merge', action='store_true',
                        help='Merge into existing --out file instead of overwriting (dedupes by slug)')
    parser.add_argument('--delay', type=float, default=0.5)
    parser.add_argument('--works', action='store_true',
                        help='Instead of scraping entries, crawl ideas-by-creations and '
                             'add a "works" field to the existing --out file')
    parser.add_argument('--works-limit', type=int, default=None,
                        help='Limit number of creations fetched (for testing)')
    args = parser.parse_args()

    if args.works:
        scrape_works(args.out, delay=args.delay, limit=args.works_limit)
        return

    print(f'Fetching alphabetic index...', file=sys.stderr)
    urls = get_entry_urls_alphabetic(limit=args.limit, offset=args.offset)
    print(f'Found {len(urls)} entry URLs (offset {args.offset})', file=sys.stderr)

    entries = []
    for i, url in enumerate(urls):
        print(f'  [{i+1}/{len(urls)}] {url}', file=sys.stderr)
        try:
            entry = parse_entry(url)
            entries.append(entry)
        except Exception as e:
            print(f'    ERROR: {e}', file=sys.stderr)
        if args.delay and i < len(urls) - 1:
            time.sleep(args.delay)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if args.merge and out_path.exists():
        with open(out_path, encoding='utf-8') as f:
            existing = json.load(f)
        by_slug = {e['slug']: e for e in existing}
        for e in entries:
            by_slug[e['slug']] = e
        entries = list(by_slug.values())
        print(f'Merged: {len(existing)} existing + new → {len(entries)} total', file=sys.stderr)

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    print(f'\nWritten {len(entries)} entries → {out_path}', file=sys.stderr)
    if entries:
        e = entries[0]
        print(f"Sample entry: {e['title_he']} | {e['title_en']} | authors: {e['authors']}")
        print(f"  body words: {e['word_count']}, bib items: {len(e['bibliography'])}, xrefs: {len(e['cross_refs'])}")


if __name__ == '__main__':
    main()
