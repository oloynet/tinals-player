from playwright.sync_api import sync_playwright, expect
import time
import re

def test_timeline_order(page):
    # Load the app
    # Using a cache buster to ensure fresh load
    page.goto("http://localhost:8080/index.html?v=test")

    # Wait for the feed to be present (data loaded)
    expect(page.locator("#main-feed")).to_be_visible(timeout=10000)

    # Wait a bit for JS to initialize data
    time.sleep(2)

    # Open the Timeline drawer via JS for reliability
    page.evaluate("toggleFavTimelineDrawer('timeline')")

    # Wait for the drawer to be active
    # using regex to match 'active' class presence
    expect(page.locator("#fav-timeline-drawer")).to_have_class(re.compile(r"active"))

    # Wait for the timeline list to have items
    timeline_list = page.locator("#timeline-list ul li")
    expect(timeline_list.first).to_be_visible(timeout=5000)

    # Get the text of the first few items
    items_locator = page.locator(".timeline-item .time-row-title h3")
    count = items_locator.count()
    print(f"Found {count} items in timeline.")

    items = []
    for i in range(min(5, count)):
        items.append(items_locator.nth(i).inner_text())

    print("First 5 items:", items)

    # Verify against data.json order (based on my previous read)
    expected_first_5 = [
        "16 HORSEPOWER",
        "AUGUSTA",
        "BANDIT BANDIT",
        "BEN KWELLER",
        "BLACK COUNTRY, NEW ROAD"
    ]

    for i, name in enumerate(expected_first_5):
        if i < len(items):
            print(f"Checking item {i}: Expected '{name}', Got '{items[i]}'")
            assert items[i] == name, f"Mismatch at index {i}: Expected {name}, got {items[i]}"

    # Screenshot
    page.screenshot(path="verification/timeline_order.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 375, "height": 667})
        try:
            test_timeline_order(page)
            print("Verification passed!")
        except Exception as e:
            print(f"Verification failed: {e}")
            try:
                page.screenshot(path="verification/error.png")
            except:
                pass
            raise
        finally:
            browser.close()
