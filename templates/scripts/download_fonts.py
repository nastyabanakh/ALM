#!/usr/bin/env python3
"""
Download Google Fonts as Self-Hosted WOFF2 files into assets/fonts/
Usage:
    python3 download_fonts.py --family "DM Serif Display" --weights 400 --styles normal,italic
    python3 download_fonts.py --family "Fixel" --weights 400,700 --styles normal
"""

import os
import sys
import argparse
import urllib.request
import urllib.parse
import json
import re

FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts")

def download_google_font(family, weights, styles=["normal"]):
    os.makedirs(FONTS_DIR, exist_ok=True)
    family_slug = family.lower().replace(" ", "-")
    print(f"[*] Fetching font: {family} ({weights}) -> {FONTS_DIR}")

    # Build user-agent that requests WOFF2
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    # Format CSS request URL
    weight_str = ";".join(str(w) for w in sorted(weights))
    url = f"https://fonts.googleapis.com/css2?family={urllib.parse.quote(family)}:wght@{weight_str}&display=swap"
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            css_content = resp.read().decode("utf-8")
        
        # Parse font URLs from CSS
        font_blocks = re.findall(r"@font-face\s*\{([^}]+)\}", css_content)
        for block in font_blocks:
            w_match = re.search(r"font-weight:\s*(\d+)", block)
            s_match = re.search(r"font-style:\s*(\w+)", block)
            src_match = re.search(r"src:\s*url\((https:[^)]+)\)\s*format\('woff2'\)", block)
            
            if w_match and src_match:
                weight = w_match.group(1)
                style = s_match.group(1) if s_match else "normal"
                font_url = src_match.group(1)
                
                filename = f"{family_slug}-{weight}{'-' + style if style != 'normal' else ''}.woff2"
                filepath = os.path.join(FONTS_DIR, filename)
                
                print(f"    -> Downloading {filename}...")
                urllib.request.urlretrieve(font_url, filepath)
        
        print(f"[✓] Successfully downloaded {family} into assets/fonts/")
    except Exception as e:
        print(f"[!] Notice: Automated Google Fonts fetch for '{family}' failed: {e}")
        print(f"    Please manually place '{family_slug}.woff2' into assets/fonts/")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download WOFF2 fonts for project.")
    parser.add_argument("--family", required=True, help="Font family name (e.g. 'Albert Sans')")
    parser.add_argument("--weights", default="400,700", help="Comma-separated weights (e.g. 400,600,700)")
    args = parser.parse_args()

    weights_list = [int(w.strip()) for w in args.weights.split(",")]
    download_google_font(args.family, weights_list)
