from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Open page
        print("Navigating to http://localhost:8000/index.html")
        page.goto("http://localhost:8000/index.html")

        # Inject localStorage key to simulate installed app
        print("Injecting localStorage app_installed=true")
        page.evaluate("localStorage.setItem('app_installed', 'true')")

        # Reload to apply change
        print("Reloading page...")
        page.reload()

        # Open Menu
        print("Clicking menu icon...")
        page.click(".main-menu-icon")
        page.wait_for_selector("#main-menu-drawer.active")

        # Expand Settings
        print("Expanding Settings accordion...")
        # Clicking the header which contains the settings text
        settings_header = page.locator("#menu-txt-settings").locator("xpath=..")
        settings_header.click()

        # Wait a bit for animation
        time.sleep(1)

        # Check visibility of install/uninstall item
        install_li = page.locator("#menu-install-li")
        is_visible = install_li.is_visible()
        display_style = install_li.evaluate("element => window.getComputedStyle(element).display")

        print(f"Menu Item #menu-install-li Visible: {is_visible}")
        print(f"Menu Item #menu-install-li Display Style: {display_style}")

        browser.close()

if __name__ == "__main__":
    run()
