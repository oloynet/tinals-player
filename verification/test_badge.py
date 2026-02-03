from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch()
    # Set viewport to mobile or desktop. Mobile is default in logic often?
    # Let's use a standard mobile size to see the action bar clearly if needed, or desktop.
    # Action bar is fixed.
    context = browser.new_context(viewport={'width': 414, 'height': 896})
    page = context.new_page()
    page.goto("http://localhost:8080/index.html")

    # Wait for loading to finish
    page.wait_for_selector("#loader.hidden", state="attached")
    page.wait_for_selector(".summary-item")

    # Initial state: badge should not exist
    badge = page.locator("#btn-drawer-favorites .fav-count-badge")
    if badge.count() > 0:
        print("Badge should not exist initially")

    print("Clicking first favorite button...")
    # Click a favorite button (first one)
    page.locator(".summary-like-btn").first.click()

    # Wait for badge to appear
    page.wait_for_selector("#btn-drawer-favorites .fav-count-badge")
    badge_text = page.locator("#btn-drawer-favorites .fav-count-badge").inner_text()
    print(f"Badge text: {badge_text}")

    # Take screenshot of the action bar area
    # Just full page screenshot
    page.screenshot(path="verification/badge_visible.png")

    print("Clicking second favorite button...")
    page.locator(".summary-like-btn").nth(1).click()
    page.wait_for_function("document.querySelector('.fav-count-badge').innerText === '2'")

    page.screenshot(path="verification/badge_2.png")

    print("Removing first favorite...")
    page.locator(".summary-like-btn").first.click()
    page.wait_for_function("document.querySelector('.fav-count-badge').innerText === '1'")

    print("Removing second favorite...")
    page.locator(".summary-like-btn").nth(1).click()

    # Wait for badge to disappear
    # Note: wait_for_selector with state='detached'
    page.locator("#btn-drawer-favorites .fav-count-badge").wait_for(state="detached")

    print("Badge disappeared.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
