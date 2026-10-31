#!/usr/bin/env python3
"""
Downloads the cover artwork for every song in the discography.

Run it from inside the favour-ojo-v2 folder:

    python3 get-covers.py

It saves 1000x1000 covers into images/covers/ with the exact filenames the
site expects. Anything it can't find is listed at the end so you know what
still has to come from the manager by hand.

Uses Apple's public search endpoint - no signup, no API key, no password.
"""

import json
import os
import ssl
import sys
import time
import urllib.parse
import urllib.request

# (filename, song title, year, is it an EP/album rather than a single?)
TRACKS = [
    ("free",                "FREE",                2026, False),
    ("atofarati",           "Atofarati",           2025, False),
    ("iba",                 "IBA",                 2025, False),
    ("yesu-mai-girma",      "Yesu Mai Girma",      2025, False),
    ("water-to-wine-ii",    "Water To Wine II",    2025, False),
    ("marys-praise-ii",     "Mary's Praise II",    2025, False),
    ("ese",                 "Ese",                 2024, False),
    ("worship-medley-7",    "Worship Medley 7",    2024, True),
    ("spontaneous-worship", "Spontaneous Worship", 2023, True),
    ("elshaddai",           "Elshaddai",           2022, True),
]

ARTIST = "favour ojo"
OUT_DIR = os.path.join("images", "covers")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
CTX = ssl.create_default_context()


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
        return r.read()


def search(title, is_album):
    """Ask Apple for this song and return matches by Favour Ojo."""
    entity = "album" if is_album else "song"
    hits = []
    # NG first (her home store), then US as a fallback.
    for country in ("NG", "US"):
        q = urllib.parse.urlencode({
            "term": "Favour Ojo " + title,
            "entity": entity,
            "country": country,
            "limit": 25,
        })
        try:
            data = json.loads(get("https://itunes.apple.com/search?" + q))
        except Exception as e:
            print("      (search failed in %s: %s)" % (country, e))
            continue

        for r in data.get("results", []):
            artist = (r.get("artistName") or "").lower()
            name = (r.get("trackName") or r.get("collectionName") or "").lower()
            if ARTIST in artist and title.lower().rstrip("!?. ") in name:
                hits.append(r)
        if hits:
            break
        time.sleep(0.4)
    return hits


def big(url):
    """Apple returns a 100px thumbnail - swap it up to 1000px."""
    for size in ("100x100bb", "60x60bb", "30x30bb"):
        if size in url:
            return url.replace(size, "1000x1000bb")
    return url


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    found, missing, links = [], [], []

    for slug, title, year, is_album in TRACKS:
        dest = os.path.join(OUT_DIR, slug + ".jpg")
        if os.path.exists(dest) and os.path.getsize(dest) > 5000:
            print("  skip  %-22s already there" % title)
            found.append(title)
            continue

        print("  ...   %s" % title)
        hits = search(title, is_album)
        if not hits:
            print("  MISS  %-22s not found" % title)
            missing.append(title)
            time.sleep(0.4)
            continue

        # Prefer a hit whose release year matches what we expect.
        hit = hits[0]
        for h in hits:
            if str(year) in (h.get("releaseDate") or ""):
                hit = h
                break

        art = hit.get("artworkUrl100") or hit.get("artworkUrl60")
        if not art:
            print("  MISS  %-22s no artwork on the record" % title)
            missing.append(title)
            continue

        try:
            img = get(big(art))
            with open(dest, "wb") as f:
                f.write(img)
            print("  OK    %-22s %d KB" % (title, len(img) // 1024))
            found.append(title)
            url = hit.get("trackViewUrl") or hit.get("collectionViewUrl")
            if url:
                links.append((title, url.split("?")[0]))
        except Exception as e:
            print("  FAIL  %-22s %s" % (title, e))
            missing.append(title)
        time.sleep(0.4)

    print("\n" + "=" * 52)
    print("Got %d of %d covers." % (len(found), len(TRACKS)))
    if missing:
        print("\nStill needed from the manager:")
        for t in missing:
            print("   - " + t)
    if links:
        print("\nApple Music links (send these to Hamza):")
        for t, u in links:
            print("   %-22s %s" % (t, u))
    print("=" * 52)
    return 0


if __name__ == "__main__":
    sys.exit(main())
