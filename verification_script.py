from playwright.sync_api import sync_playwright

def verify_changes(page):
    print("Navigating to home...")
    page.goto("http://localhost:8080")

    # Wait for intro button and click
    print("Clicking intro button...")
    page.locator(".intro-btn").first.click()

    # Wait for first video card to be active
    print("Waiting for video card...")
    page.wait_for_selector(".video-card.active", timeout=10000)

    # 1. Verify Expanded Description
    print("Expanding description...")
    # Find the description in the active card
    desc = page.locator(".video-card.active .description")
    desc.click()

    # Wait for expansion transition
    page.wait_for_timeout(1000)

    # Take screenshot of expanded description
    print("taking screenshot expanded_description.png")
    page.screenshot(path="expanded_description.png")

    # Close description
    print("Closing description...")
    desc.click()
    page.wait_for_timeout(1000)

    # 2. Verify Tag Filtering
    print("Clicking a tag...")
    # Find a tag in the active card
    tag = page.locator(".video-card.active .tag-pill").first
    tag_text = tag.text_content()
    print(f"Tag: {tag_text}")
    tag.click()

    # Wait for filter to apply
    page.wait_for_timeout(1000)

    # Take screenshot of active tag
    print("taking screenshot active_tag.png")
    page.screenshot(path="active_tag.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile-like viewport to verify the layout
        context = browser.new_context(viewport={"width": 375, "height": 667})
        page = context.new_page()
        try:
            verify_changes(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
