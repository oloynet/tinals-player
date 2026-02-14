from playwright.sync_api import sync_playwright
import time

def verify(page):
    # Go to app
    page.goto("http://localhost:8080/index.html")
    page.wait_for_selector("#main-feed")

    print("1. Verifying Flags in Menu...")
    page.click(".main-menu-icon")
    time.sleep(1)
    page.screenshot(path="verification/menu_flags.png")

    # Close Menu
    page.click("#main-menu-drawer .btn-close-drawer")
    time.sleep(1)

    print("2. Verifying About Modal...")
    page.click(".main-menu-icon")
    time.sleep(1)
    # Click About Menu Item
    page.click("#menu-txt-about")
    time.sleep(1)
    page.screenshot(path="verification/about_modal.png")

    # Close About
    page.click("#about-modal .btn-close-drawer")
    time.sleep(1)

    # Close Menu (if open)
    # Check if menu is active
    if "active" in page.get_attribute("#main-menu-drawer", "class"):
        page.click("#main-menu-drawer .btn-close-drawer")
        time.sleep(1)

    print("3. Verifying Play Button in Program...")
    page.evaluate("document.getElementById('program').scrollIntoView()")
    time.sleep(1)

    page.screenshot(path="verification/program_section.png")

    # Check if play button exists
    play_btns = page.query_selector_all(".program-play-btn")
    print(f"Found {len(play_btns)} play buttons")

    if play_btns:
        print("Clicking play button...")
        play_btns[0].click()
        time.sleep(2)
        page.screenshot(path="verification/playing.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 375, "height": 812})
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
