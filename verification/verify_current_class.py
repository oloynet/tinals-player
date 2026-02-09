import time
from playwright.sync_api import sync_playwright

def verify_is_current():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 375, 'height': 812})
        page = context.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        print("Navigating to home...")
        page.goto("http://localhost:8080/")

        # Wait for data to load
        page.wait_for_selector(".video-card")

        # Find the first video card ID
        first_video_card = page.locator(".video-card").first
        video_id = first_video_card.get_attribute("data-id")
        print(f"First video ID: {video_id}")

        # Scroll to the first video card to trigger IntersectionObserver
        print("Scrolling to first video...")
        first_video_card.scroll_into_view_if_needed()

        # Wait a bit for observer to fire and class to be added
        time.sleep(2)

        # Check summary item for is-current
        summary_item = page.locator(f".summary-grid .summary-item[data-id='{video_id}']").first

        print("Checking is-current class...")
        classes = summary_item.get_attribute("class")
        if "is-current" in classes:
            print("SUCCESS: is-current class found on summary item.")
        else:
            print("FAILURE: is-current class NOT found on summary item.")
            print(f"Classes: {classes}")

        if "is-playing" not in classes:
            print("SUCCESS: is-playing class correctly absent.")
        else:
            print("FAILURE: is-playing class unexpectedly found.")

        # Snapshot page (keeps scroll position)
        page.screenshot(path="verification/step1_page_scrolled.png")

        print("Simulating play...")
        page.evaluate(f"VideoManager.onStateChange({{data: 1}}, {video_id}, document.getElementById('video-{video_id}'))")

        time.sleep(2)

        # Check classes again
        # We need to re-fetch classes
        classes_playing = summary_item.get_attribute("class")

        if "is-playing" in classes_playing:
             print("SUCCESS: is-playing class found after play.")
        else:
             print("FAILURE: is-playing class still not found.")

        if "is-current" in classes_playing:
            print("SUCCESS: is-current class preserved after play.")
        else:
            print("FAILURE: is-current class lost after play.")
            print(f"Classes: {classes_playing}")

        page.screenshot(path="verification/step2_page_playing.png")

        # Open At A Glance Drawer to verify there too
        print("Opening At-A-Glance Drawer...")
        page.evaluate("toggleAtAGlanceDrawer()")
        time.sleep(1)

        # Note: toggling drawer might cause scroll or layout change, but we are looking at drawer item now.
        drawer_item = page.locator(f"#at-a-glance-drawer .summary-item[data-id='{video_id}']")
        drawer_classes = drawer_item.get_attribute("class")

        if "is-current" in drawer_classes:
             print("SUCCESS: is-current found in drawer.")
        else:
             print("FAILURE: is-current NOT found in drawer.")
             print(f"Drawer Classes: {drawer_classes}")

        if "is-playing" in drawer_classes:
             print("SUCCESS: is-playing found in drawer.")
        else:
             print("FAILURE: is-playing NOT found in drawer.")

        page.screenshot(path="verification/step3_drawer.png")

        browser.close()

if __name__ == "__main__":
    verify_is_current()
