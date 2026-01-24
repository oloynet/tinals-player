from playwright.sync_api import sync_playwright, expect

def verify_overlay():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to local server
        page.goto("http://localhost:8080")

        # Wait for data to load and render
        page.wait_for_selector(".video-card")

        # Select the first video card's click layer
        click_layer = page.locator(".video-card").first.locator(".video-click-layer")

        # Assert existence
        expect(click_layer).to_be_attached()

        # Check computed styles
        # Note: z-index might return string "3"
        z_index = click_layer.evaluate("el => window.getComputedStyle(el).zIndex")
        cursor = click_layer.evaluate("el => window.getComputedStyle(el).cursor")
        position = click_layer.evaluate("el => window.getComputedStyle(el).position")

        print(f"z-index: {z_index}")
        print(f"cursor: {cursor}")
        print(f"position: {position}")

        if z_index != "3":
            print("FAILED: z-index is not 3")
            exit(1)

        if cursor != "pointer":
            print("FAILED: cursor is not pointer")
            exit(1)

        # Highlight the layer for the screenshot
        click_layer.evaluate("el => el.style.border = '5px solid red'")
        click_layer.evaluate("el => el.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'")

        # Take screenshot
        page.screenshot(path="verification/verification.png")
        print("Screenshot saved to verification/verification.png")

        browser.close()

if __name__ == "__main__":
    verify_overlay()
