import time
import json
import os
import re
import unicodedata
from datetime import datetime
from playwright.sync_api import sync_playwright
from PIL import Image

# Configuration
BASE_URL = "http://localhost:8080"
OUTPUT_DIR = "screenshots"
VIEWPORT = {"width": 360, "height": 772}
DATA_FILE = "data/2026/data.json"

def get_slug(text):
    text = text.lower()
    text = unicodedata.normalize('NFD', text)
    text = re.sub(r'[\u0300-\u036f]', '', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def take_screenshot(page, context, lang, sequence_num):
    # Format: LANG-NNN-context-YYYY-MM-DD_HH-mm.webp
    timestamp     = datetime.now().strftime("%Y-%m-%d-%H%M")
    filename_base = f"{lang.upper()}-{str(sequence_num).zfill(3)}-{context}-{timestamp}"
    png_path      = os.path.join(OUTPUT_DIR, f"{filename_base}.png")
    webp_path     = os.path.join(OUTPUT_DIR, f"{filename_base}.webp")

    # Capture PNG
    page.screenshot(path=png_path, type="png")

    # Convert to WEBP
    try:
        with Image.open(png_path) as im:
            im.save(webp_path, "WEBP", quality=80)
        os.remove(png_path)
        print(f"Captured: {filename_base}.webp")
    except Exception as e:
        print(f"Error converting {filename_base}: {e}")

    return sequence_num + 1

def run_process():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    with open(DATA_FILE, 'r') as f:
        artists_data = json.load(f)

    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch()
        # Use context to emulate mobile if needed, or just viewport
        context = browser.new_context(viewport=VIEWPORT, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1")
        page = context.new_page()

        # Iterate Languages
        for lang in ['fr', 'en']:
            print(f"--- Processing Language: {lang.upper()} ---")
            seq = 0

            # Load App
            url = f"{BASE_URL}?lang={lang}"
            print(f"Loading {url}...")
            page.goto(url)

            # Inject CSS to hide error overlay
            page.add_style_tag(content=".video-error-overlay { display: none !important; }")

            # Wait for home
            try:
                page.wait_for_selector("#home", state="visible", timeout=10000)
            except:
                print("Timeout waiting for #home. Check server.")
                continue # Skip language if load fails

            # Wait for animations
            time.sleep(2)

            # 000 - Home
            seq = take_screenshot(page, "home", lang, seq)

            # 001 - Menu
            # Open Menu
            page.click(".main-menu-icon")
            page.wait_for_selector("#main-menu-drawer.active")
            time.sleep(1)
            seq = take_screenshot(page, "menu", lang, seq)

            # 002 - About Modal
            # Click 'A propos'. Note: This opens modal ON TOP of menu.
            page.click("#menu-txt-about")
            page.wait_for_selector("#about-modal.active")
            time.sleep(1)
            seq = take_screenshot(page, "modal-about", lang, seq)

            # Close About Modal
            page.click("#about-modal .btn-close-drawer")
            time.sleep(0.5)
            # Menu should still be open.

            # 003 - Share Modal
            # Click Share in Menu. Note: This CLOSES menu and opens Share.
            page.click("#menu-txt-share")
            page.wait_for_selector("#share-box-modal.active")
            time.sleep(1)
            seq = take_screenshot(page, "modal-share", lang, seq)

            # Close Share Modal
            page.click("#btn-close-share")
            time.sleep(0.5)

            # 004 - Features Modal (Try via JS)
            page.evaluate("openFeaturesModal()")
            time.sleep(0.5)
            if page.evaluate("document.getElementById('features-modal').classList.contains('active')"):
                seq = take_screenshot(page, "modal-features", lang, seq)
                page.evaluate("closeFeaturesModal()")
                time.sleep(0.5)
            else:
                print("Features modal did not open via JS. Skipping.")

            # 005 - Favorites Drawer (Empty)
            # Ensure menu is closed (handleMenuAction('share') closed it)
            # Check just in case
            if page.evaluate("document.getElementById('main-menu-drawer').classList.contains('active')"):
                 page.evaluate("closeMainMenu()")
                 time.sleep(0.5)

            page.click("#btn-drawer-favorites")
            page.wait_for_selector("#fav-timeline-drawer.active")
            time.sleep(1)
            seq = take_screenshot(page, "drawer-favorites", lang, seq)

            # Close Drawer
            page.click("#fav-timeline-drawer .btn-close-drawer")
            time.sleep(0.5)

            # 006 - At A Glance (Program)
            # Open At A Glance
            # Click bottom bar button
            page.click("#btn-at-a-glance")
            # Or use JS to be safe: page.evaluate("toggleAtAGlanceDrawer()")
            page.wait_for_selector("#at-a-glance-drawer.active")
            time.sleep(1)
            seq = take_screenshot(page, "drawer-at-a-glance", lang, seq)

            # 007 - Filter Day 1 (in At A Glance)
            try:
                # Selector: #at-a-glance-list .program-separator[data-slug="day-1"]
                sep_selector = '#at-a-glance-list .program-separator[data-slug="day-1"]'
                if page.query_selector(sep_selector):
                    page.click(sep_selector)
                    time.sleep(1)
                    seq = take_screenshot(page, "filter-day-1", lang, seq)
                else:
                    print("Day 1 separator not found in drawer.")
            except Exception as e:
                print(f"Error filtering Day 1: {e}")

            # 008 - Filter Day 2
            # Cancel filters first
            page.evaluate("cancelFilters()")
            time.sleep(0.5)

            try:
                sep_selector = '#at-a-glance-list .program-separator[data-slug="day-2"]'
                # Note: If Day 1 was active, Day 2 was hidden. But we cancelled filters.
                # However, confirm cancellation worked.
                page.wait_for_selector(sep_selector, state="visible", timeout=2000)

                if page.is_visible(sep_selector):
                    page.click(sep_selector)
                    time.sleep(1)
                    seq = take_screenshot(page, "filter-day-2", lang, seq)
                else:
                    print("Day 2 separator not visible.")
            except Exception as e:
                print(f"Error filtering Day 2: {e}")

            # Cancel filters and Close Drawer
            page.evaluate("cancelFilters()")
            page.click("#at-a-glance-drawer .btn-close-drawer")
            time.sleep(1)

            # 009... Artists
            for i, artist in enumerate(artists_data):
                artist_id = artist['id']
                artist_slug = get_slug(artist['event_name'])

                # Scroll to card
                card_selector = f"#video-{artist_id}"

                try:
                    # Check visibility
                    if not page.query_selector(card_selector):
                        print(f"Card {artist_id} not found in DOM.")
                        continue

                    page.locator(card_selector).scroll_into_view_if_needed()
                    time.sleep(0.5)

                    # Expand description
                    # We click the avatar container to toggle description
                    trigger_selector = f"{card_selector} .artist-avatar-container"

                    # Ensure trigger is visible
                    if not page.is_visible(trigger_selector):
                         page.wait_for_selector(f"{card_selector}.active", timeout=2000)

                    page.click(trigger_selector)

                    # Wait for expanded class
                    desc_selector = f"{card_selector} .artist-description"
                    page.wait_for_selector(f"{desc_selector}.expanded", timeout=2000)
                    time.sleep(0.5) # Animation

                    # Screenshot
                    seq = take_screenshot(page, artist_slug, lang, seq)

                    # Close description
                    page.click(trigger_selector)
                    time.sleep(0.5)

                except Exception as e:
                    print(f"Error capturing artist {artist_slug} ({artist_id}): {e}")

        browser.close()

if __name__ == "__main__":
    run_process()
