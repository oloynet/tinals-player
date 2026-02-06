from playwright.sync_api import sync_playwright
import time

def verify_summary_separator():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport to match expected behavior
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        # Navigate to the app (served by python http.server on port 8080)
        page.goto("http://localhost:8080")

        # Wait for the data to load and the summary section to be populated
        # We look for the summary card which contains the separators
        page.wait_for_selector("#summary-card")

        # Navigate to the summary section to ensure it's visible (click header button if needed, or just scroll)
        # Assuming the summary is below the home section
        summary_section = page.locator("#summary-card")
        summary_section.scroll_into_view_if_needed()

        # Wait a bit for any dynamic content/animations
        time.sleep(2)

        # Take a screenshot of the summary section including the separator
        page.screenshot(path="verification/summary_separator.png", full_page=True)

        print("Screenshot taken: verification/summary_separator.png")
        browser.close()

if __name__ == "__main__":
    verify_summary_separator()
