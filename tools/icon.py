import argparse
import os
import sys
import shutil
import re
import json
from pathlib import Path

try:
    import cairosvg
    from PIL import Image
except ImportError:
    print("Error: Missing dependencies. Please run with 'uv run icon.py ...'")
    sys.exit(1)

# Constants
THEME_COLOR = "#e9552b" # Default, will try to read from config
BACKGROUND_COLOR = "#000000"

ICONS_CONFIG = [
    {"name": "favicon.ico", "size": [(16, 16), (32, 32), (48, 48)], "type": "ico"},
    {"name": "apple-touch-icon.png", "size": (180, 180), "type": "png"},
    {"name": "android-chrome-192x192.png", "size": (192, 192), "type": "png"},
    {"name": "android-chrome-512x512.png", "size": (512, 512), "type": "png"},
    {"name": "favicon-maskable-192x192.png", "size": (192, 192), "type": "maskable"},
    {"name": "favicon-maskable-512x512.png", "size": (512, 512), "type": "maskable"},
    {"name": "favicon.svg", "size": (512, 512), "type": "svg_copy"},
]

def get_project_root():
    # Assuming script is in tools/
    return Path(__file__).parent.parent

def load_config_colors(root):
    try:
        config_path = root / "config" / "config.json"
        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                site = data.get("site", {})
                return site.get("theme_color", THEME_COLOR), site.get("background_color", BACKGROUND_COLOR)
    except Exception as e:
        print(f"Warning: Could not read config.json for colors: {e}")
    return THEME_COLOR, BACKGROUND_COLOR

def generate_icon(svg_path, dest_dir, icon_def, theme_color, bg_color):
    dest_path = dest_dir / icon_def["name"]
    print(f"Generating {dest_path}...")

    if icon_def["type"] == "svg_copy":
        shutil.copy(svg_path, dest_path)
        return

    if icon_def["type"] == "ico":
        # Generate multiple PNGs then combine
        img_list = []
        for size in icon_def["size"]:
            png_data = cairosvg.svg2png(url=str(svg_path), output_width=size[0], output_height=size[1])
            with open(dest_dir / f"tmp_{size[0]}.png", "wb") as f:
                f.write(png_data)
            img = Image.open(dest_dir / f"tmp_{size[0]}.png")
            img_list.append(img)

        # Save ICO
        img_list[0].save(dest_path, format="ICO", sizes=[(i.width, i.height) for i in img_list], append_images=img_list[1:])

        # Cleanup
        for size in icon_def["size"]:
            (dest_dir / f"tmp_{size[0]}.png").unlink()

    elif icon_def["type"] == "png":
        w, h = icon_def["size"]
        cairosvg.svg2png(url=str(svg_path), write_to=str(dest_path), output_width=w, output_height=h)

    elif icon_def["type"] == "maskable":
        w, h = icon_def["size"]
        # Maskable: 10% padding (safe zone is center 80%, so 10% each side)
        # We render SVG at 80% size
        icon_w, icon_h = int(w * 0.8), int(h * 0.8)

        tmp_png = dest_dir / f"tmp_mask_{w}.png"
        cairosvg.svg2png(url=str(svg_path), write_to=str(tmp_png), output_width=icon_w, output_height=icon_h)

        foreground = Image.open(tmp_png).convert("RGBA")

        # Create background
        background = Image.new('RGBA', (w, h), theme_color)

        # Paste foreground in center
        offset = ((w - icon_w) // 2, (h - icon_h) // 2)
        background.paste(foreground, offset, foreground)

        background.save(dest_path)
        tmp_png.unlink()

def update_manifest_json(root):
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        print("manifest.json not found")
        return

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    icons = [
        {"src": "assets/favicon/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "assets/favicon/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "assets/favicon/favicon-maskable-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
        {"src": "assets/favicon/favicon-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        {"src": "assets/favicon/favicon.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "any maskable"}
    ]

    data["icons"] = icons

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=3)
    print("Updated manifest.json")

def update_service_worker(root):
    sw_path = root / "service-worker.js"
    if not sw_path.exists():
        return

    content = sw_path.read_text(encoding="utf-8")

    new_assets = [
        "    './assets/favicon/favicon.ico',",
        "    './assets/favicon/apple-touch-icon.png',",
        "    './assets/favicon/android-chrome-192x192.png',",
        "    './assets/favicon/android-chrome-512x512.png',",
        "    './assets/favicon/favicon-maskable-192x192.png',",
        "    './assets/favicon/favicon-maskable-512x512.png',",
        "    './assets/favicon/favicon.svg',"
    ]

    lines = content.splitlines()
    new_lines = []
    in_assets = False

    for line in lines:
        if "const STATIC_ASSETS = [" in line:
            in_assets = True

        if in_assets and "];" in line:
            in_assets = False
            # Insert our new assets before closing
            for asset in new_assets:
                new_lines.append(asset)
            new_lines.append(line)
            continue

        if in_assets:
            if "assets/favicon" in line:
                continue # Skip existing favicon lines
            new_lines.append(line)
        else:
            new_lines.append(line)

    sw_path.write_text("\n".join(new_lines), encoding="utf-8")
    print("Updated service-worker.js")

def update_index_html(root):
    index_path = root / "index.html"
    if not index_path.exists():
        return

    content = index_path.read_text(encoding="utf-8")

    # Use regex to replace
    content = re.sub(r'<link rel="icon" href=".*?">', '<link rel="icon" href="assets/favicon/favicon.ico">', content)
    content = re.sub(r'<link rel="apple-touch-icon" href=".*?">', '<link rel="apple-touch-icon" href="assets/favicon/apple-touch-icon.png">', content)

    index_path.write_text(content, encoding="utf-8")
    print("Updated index.html")

def update_app_js(root):
    app_js_path = root / "assets" / "js" / "app.js"
    if not app_js_path.exists():
        return

    content = app_js_path.read_text(encoding="utf-8")

    new_icons_js = """icons: [
                {
                    src: "assets/favicon/android-chrome-192x192.png",
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: "assets/favicon/android-chrome-512x512.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: "assets/favicon/favicon-maskable-192x192.png",
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "maskable"
                },
                {
                    src: "assets/favicon/favicon-maskable-512x512.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "maskable"
                },
                {
                    src: "assets/favicon/favicon.svg",
                    sizes: "512x512",
                    type: "image/svg+xml",
                    purpose: "any maskable"
                }
            ]"""

    pattern = r'icons:\s*\[\s*\{.*?\}\s*\]'

    match = re.search(pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + new_icons_js + content[match.end():]
    else:
        print("Warning: Could not find icons array in app.js")

    content = content.replace("// DESACTIVATE document.querySelector", "document.querySelector")

    app_js_path.write_text(content, encoding="utf-8")
    print("Updated app.js")

def main():
    parser = argparse.ArgumentParser(description="Generate favicons and update project.")
    parser.add_argument("--destination", required=True, help="Directory name (destination folder)")
    parser.add_argument("--update", action="store_true", help="Update of the main project")
    parser.add_argument("svg_filename", help="Input SVG filename")

    args = parser.parse_args()

    root = get_project_root()
    svg_path = Path(args.svg_filename).resolve()
    dest_dir = Path(args.destination).resolve()

    if not svg_path.exists():
        print(f"Error: File {svg_path} not found.")
        sys.exit(1)

    if not dest_dir.exists():
        dest_dir.mkdir(parents=True)

    theme_color, bg_color = load_config_colors(root)
    print(f"Using Theme Color: {theme_color}")

    # Generate Images
    for icon_def in ICONS_CONFIG:
        generate_icon(svg_path, dest_dir, icon_def, theme_color, bg_color)

    if args.update:
        print("Updating project files...")
        target_assets_dir = root / "assets" / "favicon"
        if not target_assets_dir.exists():
            target_assets_dir.mkdir(parents=True)

        # Copy files
        for icon_def in ICONS_CONFIG:
            src = dest_dir / icon_def["name"]
            dst = target_assets_dir / icon_def["name"]
            shutil.copy(src, dst)
            print(f"Copied {icon_def['name']} to assets/favicon/")

        update_index_html(root)
        update_app_js(root)
        update_service_worker(root)
        update_manifest_json(root)
        print("Update complete.")

if __name__ == "__main__":
    main()
