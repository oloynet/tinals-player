from playwright.sync_api import sync_playwright, expect
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 360, "height": 772})

        # Open page
        print("Navigating to http://localhost:8000/index.html")
        page.goto("http://localhost:8000/index.html")

        # Inject localStorage key
        print("Injecting localStorage app_installed=true")
        page.evaluate("localStorage.setItem('app_installed', 'true')")

        # Reload
        print("Reloading page...")
        page.reload()

        # Open Menu
        print("Clicking menu icon...")
        page.click(".main-menu-icon")
        page.wait_for_selector("#main-menu-drawer.active")
        time.sleep(1)

        # Expand Settings
        print("Expanding Settings accordion...")
        settings_header = page.locator("#menu-txt-settings").locator("xpath=..")
        settings_header.scroll_into_view_if_needed()
        settings_header.click()

        time.sleep(1)

        # Check visibility
        install_li = page.locator("#menu-install-li")
        expect(install_li).to_be_visible()

        install_text = page.locator("#menu-txt-install")
        print(f"Install Menu Text: {install_text.inner_text()}")

        # Scroll item into view for screenshot
        install_li.scroll_into_view_if_needed()

        # Take screenshot of the menu drawer specifically, or full page
        # Let's take full page (viewport) but ensure we are scrolled
        screenshot_path = os.path.abspath("verification/menu_uninstall_visible.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
