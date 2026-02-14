import argparse
import json
import os
import sys

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    default_config = os.path.join(root_dir, "config", "config.local.json")
    default_html = os.path.join(root_dir, "index.html")

    parser = argparse.ArgumentParser(description="Update index.html base URL placeholders.")
    parser.add_argument("--url", help="The base URL (e.g., https://example.com/player/).")
    parser.add_argument("--config", default=default_config, help="Path to local config file to read site.url from.")
    parser.add_argument("--file", default=default_html, help="Path to index.html.")

    args = parser.parse_args()

    base_url = args.url

    # Try to load from config if URL not provided
    if not base_url and os.path.exists(args.config):
        try:
            with open(args.config, 'r') as f:
                config = json.load(f)
                base_url = config.get('site', {}).get('url')
                # Ensure trailing slash if it's a directory URL, unless it looks like a file
                if base_url and not base_url.endswith('/') and not base_url.endswith('.html'):
                     base_url += '/'
        except Exception as e:
            print(f"Error reading config: {e}")

    if not base_url:
        print("Error: No URL provided via argument --url or found in config file.")
        sys.exit(1)

    if not os.path.exists(args.file):
        print(f"Error: File {args.file} not found.")
        sys.exit(1)

    print(f"Updating {args.file} with base URL: {base_url}")

    try:
        with open(args.file, 'r', encoding='utf-8') as f:
            content = f.read()

        if "__BASE_URL__" not in content:
            print("Warning: Placeholder __BASE_URL__ not found in file. Maybe it was already updated?")

        new_content = content.replace("__BASE_URL__", base_url)

        with open(args.file, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print("Success.")

    except Exception as e:
        print(f"Error updating file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
