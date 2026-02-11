from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the local server
        page.goto("http://localhost:8080/")

        # Wait for loader to disappear
        page.wait_for_selector("#loader.hidden", state="attached", timeout=10000)

        # Wait a bit for animations
        time.sleep(2)

        # Screenshot Home
        page.screenshot(path="verification/home.png")
        print("Home screenshot taken")

        # Open Main Menu
        page.click(".main-menu-icon")
        time.sleep(1)
        page.screenshot(path="verification/menu.png")
        print("Menu screenshot taken")

        # Close Menu
        page.locator("#main-menu-drawer .btn-close-drawer").click()
        time.sleep(1)

        # Toggle Favorite on first video (if any)
        # We need to find a video card.
        # Check if we have video cards
        cards = page.query_selector_all(".video-card")
        if cards:
            print(f"Found {len(cards)} cards")
            # Scroll to first card
            cards[0].scroll_into_view_if_needed()
            time.sleep(1)

            # Click favorite button in action bar (dynamic heart)
            page.click("#btn-dynamic-heart")
            time.sleep(1)
            page.screenshot(path="verification/favorite_toggled.png")
            print("Favorite toggled screenshot taken")

            # The drawer opens automatically on favorite toggle.
            # Wait for drawer to be active
            try:
                page.wait_for_selector("#fav-timeline-drawer.active", timeout=2000)
                print("Favorites drawer auto-opened")
            except:
                print("Favorites drawer did not auto-open, clicking button")
                # If not open, click the button
                page.click("#btn-drawer-favorites")
                time.sleep(1)

            page.screenshot(path="verification/favorites_drawer.png")
            print("Favorites drawer screenshot taken")

        else:
            print("No video cards found")

        browser.close()

if __name__ == "__main__":
    run()
