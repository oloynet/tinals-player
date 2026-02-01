from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Listen to console messages
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

    # Navigate to the app
    page.goto("http://localhost:8080/index.html")

    # Wait for the feed to load
    page.wait_for_selector("#main-feed")
    time.sleep(2)

    # Enable toast via JS
    page.evaluate("AppState.settings.isToastScrollPage = true;")
    print("Enabled isToastScrollPage")

    # Override showToast to be sure
    page.evaluate("""
        const originalShowToast = window.showToast;
        window.showToast = function(msg) {
            console.log("showToast called with:", msg);
            originalShowToast(msg);
        }
    """)

    # Scroll to bottom
    page.evaluate("""
        const feed = document.getElementById('main-feed');
        console.log("Before scroll: scrollTop=" + feed.scrollTop);
        feed.scrollTop = feed.scrollHeight;
        console.log("After scroll set: scrollTop=" + feed.scrollTop);
    """)

    # Wait a bit
    time.sleep(1)

    # Check if toast is visible
    toast = page.locator("#toast-message")
    class_attr = toast.get_attribute("class") or ""

    if "visible" in class_attr:
        print("PASS: Toast appeared when enabled.")
    else:
        print("FAIL: Toast did NOT appear even when enabled.")
        print(f"Class attribute: {class_attr}")

    # Screenshot
    page.screenshot(path="verification_debug.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
