from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # Using mobile viewport to verify responsive menu behavior
    page = browser.new_page(viewport={"width": 375, "height": 812})

    # Go to app
    page.goto("http://localhost:8080/index.html")

    # Wait for loading - wait for main feed to be present
    page.wait_for_selector("#main-feed")

    # Click menu icon
    print("Clicking menu icon...")
    page.locator(".main-menu-icon").click()

    # Wait for drawer to be active
    expect(page.locator("#main-menu-drawer")).to_have_class("main-menu-drawer active")
    print("Drawer active.")

    # Click settings accordion
    print("Clicking settings...")
    page.locator(".accordion-header").click()

    # Wait a bit for expansion
    page.wait_for_timeout(1000)

    # Check for the new item
    print("Checking for new item...")
    check_version_item = page.locator("#menu-txt-check-version")
    check_version_item.scroll_into_view_if_needed()
    expect(check_version_item).to_be_visible()
    expect(check_version_item).to_contain_text("Vérifier les mises à jour")

    # Take screenshot of menu
    page.screenshot(path="/home/jules/verification/menu_verification.png")
    print("Screenshot taken.")

    # Test click behavior (should show toast)
    print("Clicking check version...")
    # The onclick is on the LI parent
    page.locator("#menu-txt-check-version").locator("xpath=..").click()

    # Toast check
    print("Checking toast...")
    toast = page.locator("#toast-message")
    expect(toast).to_be_visible()
    expect(toast).to_contain_text("Votre application est à jour")
    print("Toast verified.")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
