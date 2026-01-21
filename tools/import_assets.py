import argparse
import json
import os
import subprocess
import shutil
import requests
from pathlib import Path
import re
from PIL import Image

# Disable DecompressionBombWarning for large images
Image.MAX_IMAGE_PIXELS = None

# Configuration
YEAR = "2026"
REMOTE_DATA_SOURCE = "https://thisisnotalovesong.fr/wp-content/themes/tinals/cli/tools/data.json"
LOCAL_DATA_SOURCE = f"../data/{YEAR}/data.json"
COMPRESS_WEBP = 80
# Use environment variables or defaults for binaries to allow overriding in tests
YT_DLP_BIN = os.getenv("YT_DLP_BIN", "yt-dlp")
WGET_BIN = os.getenv("WGET_BIN", "/usr/bin/wget")
MP3_DIR = f"../data/{YEAR}/mp3/"
IMAGES_DIR = f"../data/{YEAR}/images/"
TMP_DIR = "tmp/"

def load_json(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File {filepath} not found.")
        return []
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from {filepath}.")
        return []

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print(f"Updated {filepath}")

def fetch_remote_data(url):
    print(f"Fetching remote data from {url}...")
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching remote data: {e}")
        return []

def sanitize_filename(name):
    # Remove invalid characters and spaces
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', '-', name)
    return name.lower()

def ensure_dirs():
    os.makedirs(MP3_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(TMP_DIR, exist_ok=True)

def main():
    parser = argparse.ArgumentParser(description="TINALS Asset Import Tool")
    parser.add_argument("--yt-to-mp3", action="store_true", help="Extract and import mp3 files from YouTube")
    parser.add_argument("--local-mp3", action="store_true", help="Import mp3 files locally from external server")
    parser.add_argument("--local-image", action="store_true", help="Import image files locally and convert to WebP")
    parser.add_argument("--limit", type=int, help="Limit the number of items processed from the data file")

    args = parser.parse_args()

    ensure_dirs()

    if not any([args.yt_to_mp3, args.local_mp3, args.local_image]):
        parser.print_help()
        return

    local_data = load_json(LOCAL_DATA_SOURCE)
    if not local_data:
        print("No local data found or empty.")
        return

    items_to_process = local_data
    if args.limit and args.limit > 0:
        print(f"Limiting processing to first {args.limit} items.")
        items_to_process = local_data[:args.limit]

    remote_data = fetch_remote_data(REMOTE_DATA_SOURCE)
    # We might only need remote data if we actually look things up,
    # but simplest is to fetch it once if any operation needs it.
    # However, if remote fetch fails, we should handle it gracefully depending on if the operation needs it.

    if args.yt_to_mp3:
        process_yt_to_mp3(items_to_process, remote_data)
        save_json(LOCAL_DATA_SOURCE, local_data)

    if args.local_mp3:
        process_local_mp3(items_to_process, remote_data)
        save_json(LOCAL_DATA_SOURCE, local_data)

    if args.local_image:
        process_local_image(items_to_process, remote_data)
        save_json(LOCAL_DATA_SOURCE, local_data)

    # Cleanup tmp
    if os.path.exists(TMP_DIR):
        # Optional: remove tmp dir.
        # The prompt says "output tmp/..." for yt-dlp, maybe we should keep it or clean it?
        # Usually tools clean up. I'll leave it for now or clean it.
        # I'll chose to leave it as a cache or clean it?
        # Let's clean it to be tidy.
        shutil.rmtree(TMP_DIR)

def process_yt_to_mp3(local_data, remote_data):
    print("Processing YouTube to MP3...")
    # Create a map for faster lookup
    remote_map = {item['id']: item for item in remote_data if 'id' in item}

    for item in local_data:
        # Check if audio is empty
        if not item.get('audio') and item.get('id') in remote_map:
            remote_item = remote_map[item['id']]
            video_url = remote_item.get('video_url')

            if video_url:
                print(f"Extracting audio for {item.get('event_name', 'Unknown')} (ID: {item['id']})...")

                # Construct command
                output_template = f"{TMP_DIR}{item['id']}___%(title)s.%(ext)s"

                cmd = [
                    YT_DLP_BIN,
                    "--audio-quality", "0",
                    "--audio-format", "mp3",
                    "--extract-audio",
                    "--restrict-filenames",
                    "--no-windows-filenames",
                    "--rm-cache-dir",
                    "--output", output_template,
                    video_url
                ]

                try:
                    subprocess.run(cmd, check=True)

                    # Find the generated file
                    # We look for files in TMP_DIR starting with the ID and ending with .mp3
                    files = [f for f in os.listdir(TMP_DIR) if f.startswith(f"{item['id']}___") and f.endswith('.mp3')]

                    if files:
                        # We take the first mp3 found
                        src_filename = files[0]
                        src_file = os.path.join(TMP_DIR, src_filename)

                        # Determine destination filename based on event name
                        event_name = item.get('event_name')
                        if event_name:
                            dest_filename = f"{sanitize_filename(event_name)}.mp3"
                        else:
                            dest_filename = src_filename

                        dest_path = os.path.join(MP3_DIR, dest_filename)

                        # Move file
                        shutil.move(src_file, dest_path)
                        print(f"Moved to {dest_path}")

                        # Update local data with relative path
                        item['audio'] = f"data/{YEAR}/mp3/{dest_filename}"
                    else:
                        print(f"No MP3 file found in {TMP_DIR} for ID {item['id']}")

                except subprocess.CalledProcessError as e:
                    print(f"Failed to extract audio for {video_url}: {e}")
                except FileNotFoundError:
                    print(f"yt-dlp binary not found at {YT_DLP_BIN}. Please install it or set YT_DLP_BIN env var.")
                    return # Stop processing if tool is missing

def process_local_mp3(local_data, remote_data):
    print("Processing Local MP3...")
    remote_map = {item['id']: item for item in remote_data if 'id' in item}

    for item in local_data:
        if not item.get('audio') and item.get('id') in remote_map:
            remote_item = remote_map[item['id']]
            audio_url = remote_item.get('audio')

            if audio_url and isinstance(audio_url, str) and audio_url.startswith(('http://', 'https://')):
                print(f"Downloading audio for {item.get('event_name', 'Unknown')} from {audio_url}...")

                # Determine filename from URL
                filename = os.path.basename(audio_url.split("?")[0])
                if not filename:
                    filename = f"{item['id']}.mp3"

                tmp_path = os.path.join(TMP_DIR, filename)

                try:
                    subprocess.run([WGET_BIN, "-O", tmp_path, audio_url], check=True)

                    if os.path.exists(tmp_path):
                        dest_path = os.path.join(MP3_DIR, filename)
                        shutil.move(tmp_path, dest_path)
                        print(f"Downloaded to {dest_path}")

                        item['audio'] = f"data/{YEAR}/mp3/{filename}"
                    else:
                        print(f"File not found after wget: {tmp_path}")
                except subprocess.CalledProcessError as e:
                    print(f"Failed to download audio: {e}")
                except FileNotFoundError:
                    print(f"wget binary not found at {WGET_BIN}")

def process_local_image(local_data, remote_data):
    print("Processing Local Images...")
    remote_map = {item['id']: item for item in remote_data if 'id' in item}

    image_fields = {
        'image': '.webp',
        'image_mobile': '.mobile.webp',
        'image_thumbnail': '.thumbnail.webp'
    }

    for item in local_data:
        if item.get('id') in remote_map:
            remote_item = remote_map[item['id']]
            event_name = sanitize_filename(item.get('event_name', 'unknown'))

            for field, suffix in image_fields.items():
                # Check if local is empty
                if not item.get(field):
                    remote_url = remote_item.get(field)

                    if remote_url and isinstance(remote_url, str) and remote_url.startswith(('http://', 'https://')):
                         print(f"Processing {field} for {item.get('event_name', 'Unknown')}...")

                         # Download to tmp
                         ext = os.path.splitext(remote_url.split("?")[0])[1]
                         if not ext: ext = ".jpg" # fallback

                         tmp_download_path = os.path.join(TMP_DIR, f"temp_{item['id']}_{field}{ext}")

                         try:
                            subprocess.run([WGET_BIN, "-O", tmp_download_path, remote_url], check=True)

                            if os.path.exists(tmp_download_path):
                                # Convert to WebP
                                dest_filename = f"{event_name}{suffix}"
                                dest_path = os.path.join(IMAGES_DIR, dest_filename)

                                try:
                                    with Image.open(tmp_download_path) as img:
                                        img.save(dest_path, "WEBP", quality=COMPRESS_WEBP)

                                    print(f"Converted and saved to {dest_path}")
                                    # Update with relative path
                                    item[field] = f"data/{YEAR}/images/{dest_filename}"

                                except Exception as e:
                                    print(f"Failed to convert image {tmp_download_path}: {e}")
                                finally:
                                    # cleanup temp file
                                    if os.path.exists(tmp_download_path):
                                        os.remove(tmp_download_path)

                         except subprocess.CalledProcessError as e:
                            print(f"Failed to download image {remote_url}: {e}")
                         except FileNotFoundError:
                            print(f"wget binary not found at {WGET_BIN}")

if __name__ == "__main__":
    main()
