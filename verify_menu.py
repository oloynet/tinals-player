from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(service_workers="block")
        page = context.new_page()

        # Navigate
        page.goto("http://localhost:8080/index.html")

        # Wait for loader to disappear (it adds .hidden class)
        # Loader is #loader
        page.wait_for_selector("#loader.hidden", state="attached", timeout=10000)

        # Click menu icon
        menu_btn = page.locator(".main-menu-icon")
        menu_btn.click()

        # Wait for drawer
        drawer = page.locator("#main-menu-drawer")
        expect(drawer).to_have_class("main-menu-drawer active")

        # Click settings
        settings = page.locator("#menu-txt-settings")
        settings.click()

        # Wait for expansion
        accordion_item = page.locator(".accordion-item")
        expect(accordion_item).to_have_class("accordion-item expanded")

        # Screenshot
        page.screenshot(path="verification_menu.png")

        browser.close()

if __name__ == "__main__":
    run()
