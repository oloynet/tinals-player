from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Navigate to the app
    page.goto("http://localhost:8080/index.html")

    # Wait for the feed to load
    page.wait_for_selector("#main-feed")

    # Wait a bit for initial rendering
    time.sleep(2)

    # Scroll down the feed
    feed = page.locator("#main-feed")
    feed.evaluate("element => element.scrollTop = 1000")

    # Wait a bit to see if toast appears
    time.sleep(1)

    # Check if toast is visible
    toast = page.locator("#toast-message")

    class_attr = toast.get_attribute("class") or ""

    # It should NOT be visible because config is false
    if "visible" in class_attr:
        print("FAIL: Toast appeared but should be disabled.")
    else:
        print("PASS: Toast did not appear as expected.")

    # Screenshot
    page.screenshot(path="verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
