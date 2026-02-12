import time
from playwright.sync_api import sync_playwright

def verify_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Start server (assuming it's already running on 8080)
        url = "http://localhost:8080/index.html?lang=fr"
        page.goto(url)

        # Wait for data to load
        time.sleep(2)

        print("Verifying Tag Filtering (Empty Day)...")
        # Filter by "NL" (only exists on Day 1)
        page.evaluate("filterByTag('nl')")
        time.sleep(1)

        # Locate Day 2 separator in main program
        day2_sep = page.locator('#program .program-separator[data-slug="day-2"]')
        if day2_sep.is_visible():
            print("Day 2 Separator is visible.")
        else:
            print("Day 2 Separator is NOT visible.")

        # Locate Empty Placeholder for Day 2 in main program
        day2_empty = page.locator('#program .program-empty-placeholder[data-session="day-2"]')
        if day2_empty.is_visible():
            print("Day 2 Empty Message is visible.")
            text = day2_empty.inner_text()
            print(f"Empty Message Text: {text}")
            if "Aucun concert" in text:
                print("Text is correct.")
            else:
                print(f"Text is INCORRECT (expected 'Aucun concert').")
        else:
            print("Day 2 Empty Message is NOT visible.")

        page.screenshot(path="verification_tag_empty.png", full_page=True)

        print("\nVerifying Favorites (Empty Day)...")
        # Reset filters
        page.evaluate("cancelFilters()")
        time.sleep(1)

        # Add a Day 1 event to favorites (e.g., 95081 - IGUANA DEATH CULT)
        page.evaluate("toggleFav(95081, false)")

        # Activate favorites mode
        page.evaluate("playFavorites()")
        time.sleep(1)

        # Check Day 2 (should be empty)
        day2_sep = page.locator('#program .program-separator[data-slug="day-2"]')
        if day2_sep.is_visible():
            print("Day 2 Separator is visible.")
        else:
            print("Day 2 Separator is NOT visible.")

        day2_empty = page.locator('#program .program-empty-placeholder[data-session="day-2"]')
        if day2_empty.is_visible():
            print("Day 2 Empty Message is visible.")
            text = day2_empty.inner_text()
            print(f"Empty Message Text: {text}")
            if "Aucun favori" in text:
                print("Text is correct.")
            else:
                print(f"Text is INCORRECT (expected 'Aucun favori').")
        else:
            print("Day 2 Empty Message is NOT visible.")

        page.screenshot(path="verification_fav_empty.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify_features()
