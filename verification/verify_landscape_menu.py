
from playwright.sync_api import sync_playwright, expect
import time

def verify_menu_behavior():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 375, 'height': 667},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'
        )
        page = context.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

        print("Navigating to player...")
        page.goto("http://localhost:8080/")

        page.wait_for_selector(".video-card", state="visible")

        print("Starting video playback...")
        video_card = page.locator(".video-card").first
        video_card.click()

        time.sleep(2)

        print("Checking menu in Portrait (should be visible)...")
        top_drawer = page.locator("#top-drawer")
        expect(top_drawer).not_to_have_class("auto-hidden")

        # Screenshot Portrait
        page.screenshot(path="verification/1_portrait_visible.png")
        print("Screenshot saved: verification/1_portrait_visible.png")

        print("Switching to Landscape...")
        page.set_viewport_size({'width': 667, 'height': 375})

        # Manually trigger resize
        page.evaluate("window.dispatchEvent(new Event('resize'));")

        # Wait > 3 seconds for auto-hide
        time.sleep(4)

        print("Checking menu hidden...")
        try:
             # The 'auto-hidden' class makes it hidden
             # Using a regex to check for the class
             expect(top_drawer).to_have_class(re.compile(r"auto-hidden"))
             print("PASS: Menu is hidden in Landscape.")
        except Exception as e:
             # Fallback check
             if "auto-hidden" in top_drawer.get_attribute("class"):
                 print("PASS: Menu is hidden in Landscape (Manual check).")
             else:
                 print(f"FAIL: Menu is VISIBLE in Landscape. Class: {top_drawer.get_attribute('class')}")

        page.screenshot(path="verification/2_landscape_check.png")
        print("Screenshot saved: verification/2_landscape_check.png")

        browser.close()

if __name__ == "__main__":
    import re
    verify_menu_behavior()
