import argparse
import json
import os
import subprocess
import shutil
import requests
import re
import unicodedata
from PIL import Image

# Disable DecompressionBombWarning for large images
Image.MAX_IMAGE_PIXELS = None

# Configuration
YEAR               = "2026"
REMOTE_DATA_SOURCE = f"https://thisisnotalovesong.fr/data-2026-02-04.json"
LOCAL_DATA_SOURCE  = f"../data/{YEAR}/data.json"
LOCAL_CONFIG_PATH  = "../config/config.json"
COMPRESS_WEBP      = 80

# Use environment variables or defaults for binaries to allow overriding in tests
YT_DLP_BIN         = os.getenv( "YT_DLP_BIN", "yt-dlp" )
WGET_BIN           = os.getenv( "WGET_BIN", "/usr/bin/wget" )
MP3_DIR            = f"../data/{YEAR}/mp3/"
IMAGES_DIR         = f"../data/{YEAR}/images/"
TMP_DIR            = "tmp/"

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
    # Normalize unicode characters to decompose accents (e.g., 'à' -> 'a' + '`')
    name = unicodedata.normalize('NFKD', name)
    # Encode to ASCII bytes, ignoring non-ASCII characters, then decode back to string
    name = name.encode('ASCII', 'ignore').decode('utf-8')

    # Lowercase and replace spaces with dashes
    name = name.lower()
    name = re.sub(r'\s+', '-', name)
    # Remove any character that is not a-z, 0-9, dash, or dot
    name = re.sub(r'[^a-z0-9.-]', '', name)
    # Remove multiple dashes
    name = re.sub(r'-+', '-', name)
    return name

def ensure_dirs():
    os.makedirs(MP3_DIR,    exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(TMP_DIR,    exist_ok=True)

def get_image_sizes_config():
    config = load_json(LOCAL_CONFIG_PATH)
    if not config or 'sizes' not in config:
        # Fallback default if config is missing
        return [
            {"id": "image", "max-width": "1920", "action": ["resize"], "format": "webp", "compress": "80"},
            {"id": "image_mobile", "max-width": "768", "action": ["resize"], "format": "webp", "compress": "80"},
            {"id": "image_thumbnail", "max-width": "128", "action": ["resize"], "format": "webp", "compress": "80"}
        ]
    return config['sizes']

def main():
    parser = argparse.ArgumentParser(description="TINALS Asset Import Tool")
    parser.add_argument("--yt-to-mp3", action="store_true",                                     help="Extract and import mp3 files from YouTube")
    parser.add_argument("--mp3",       action="store_true",                                     help="Import mp3 files locally from external server")
    parser.add_argument("--image",     action="store_true",                                     help="Import image files locally from external server and convert to WebP")
    parser.add_argument("--limit",     type=int,                                                help="Limit the number of items processed from the data file")
    parser.add_argument("--reset",     choices=['image', 'mp3', 'all'],                         help="Reset fields and delete files")
    parser.add_argument("--force",     action="store_true",                                     help="Force overwrite existing values")
    parser.add_argument("--check",     nargs='?', const='all', choices=['image', 'mp3', 'all'], help="Check file existence and clean data")
    parser.add_argument("--max-width", type=int,                                                help="Limit the width of the image (Override config)")
    parser.add_argument("--compress",  type=int,                                                help="Set compression quality percentage (Override config)")

    args = parser.parse_args()

    ensure_dirs()

    if not any([args.yt_to_mp3, args.mp3, args.image, args.reset, args.check]):
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

    if args.reset:
        process_reset(local_data, args.reset)
        save_json(LOCAL_DATA_SOURCE, local_data)

    if args.check:
        process_check(local_data, args.check)
        save_json(LOCAL_DATA_SOURCE, local_data)

    remote_data = fetch_remote_data(REMOTE_DATA_SOURCE)

    if args.yt_to_mp3:
        process_yt_to_mp3(items_to_process, remote_data, args.force)
        save_json(LOCAL_DATA_SOURCE, local_data)

    if args.mp3:
        process_local_mp3(items_to_process, remote_data, args.force)
        save_json(LOCAL_DATA_SOURCE, local_data)

    if args.image:
        process_local_image(items_to_process, remote_data, args.force, args.max_width, args.compress)
        save_json(LOCAL_DATA_SOURCE, local_data)

    # Cleanup tmp
    if os.path.exists(TMP_DIR):
        shutil.rmtree(TMP_DIR)

def process_reset(local_data, target):
    print(f"Resetting {target}...")
    sizes_config = get_image_sizes_config()
    image_fields = [size['id'] for size in sizes_config]

    for item in local_data:
        if target in ['mp3', 'all']:
            if item.get('audio'):
                # Construct file path relative to tools/
                file_path = item['audio'].replace("data/2026/", "../data/2026/")
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"Deleted {file_path}")
                item['audio'] = ""

        if target in ['image', 'all']:
            for field in image_fields:
                if item.get(field):
                    file_path = item[field].replace("data/2026/", "../data/2026/")
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"Deleted {file_path}")
                    item[field] = ""

def process_check(local_data, target):
    print(f"Checking {target}...")
    sizes_config = get_image_sizes_config()
    image_fields = [size['id'] for size in sizes_config]

    for item in local_data:
        if target in ['mp3', 'all']:
            if item.get('audio'):
                file_path = item['audio'].replace("data/2026/", "../data/2026/")
                if not os.path.exists(file_path):
                    print(f"Missing MP3: {file_path} (removing ref)")
                    item['audio'] = ""

        if target in ['image', 'all']:
            for field in image_fields:
                if item.get(field):
                    file_path = item[field].replace("data/2026/", "../data/2026/")
                    if not os.path.exists(file_path):
                        print(f"Missing Image: {file_path} (removing ref)")
                        item[field] = ""

def process_yt_to_mp3(local_data, remote_data, force=False):
    print("Processing YouTube to MP3...")
    # Create a map for faster lookup
    remote_map = {item['id']: item for item in remote_data if 'id' in item}

    for item in local_data:
        # Check if audio is empty or force is True
        if (not item.get('audio') or force) and item.get('id') in remote_map:
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

def process_local_mp3(local_data, remote_data, force=False):
    print("Processing Local MP3...")
    remote_map = {item['id']: item for item in remote_data if 'id' in item}

    for item in local_data:
        if (not item.get('audio') or force) and item.get('id') in remote_map:
            remote_item = remote_map[item['id']]
            audio_url = remote_item.get('audio')

            if audio_url and isinstance(audio_url, str) and audio_url.startswith(('http://', 'https://')):
                print(f"Downloading audio for {item.get('event_name', 'Unknown')} from {audio_url}...")

                # Download to tmp first
                tmp_filename = f"temp_{item['id']}.mp3"
                tmp_path = os.path.join(TMP_DIR, tmp_filename)

                try:
                    subprocess.run([WGET_BIN, "-O", tmp_path, audio_url], check=True)

                    if os.path.exists(tmp_path):
                        # Determine destination filename
                        event_name = item.get('event_name')
                        if event_name:
                            dest_filename = f"{sanitize_filename(event_name)}.mp3"
                        else:
                            # Fallback if no event name
                            dest_filename = f"{item['id']}.mp3"

                        dest_path = os.path.join(MP3_DIR, dest_filename)
                        shutil.move(tmp_path, dest_path)
                        print(f"Downloaded to {dest_path}")

                        item['audio'] = f"data/{YEAR}/mp3/{dest_filename}"
                    else:
                        print(f"File not found after wget: {tmp_path}")
                except subprocess.CalledProcessError as e:
                    print(f"Failed to download audio: {e}")
                except FileNotFoundError:
                    print(f"wget binary not found at {WGET_BIN}")

def process_local_image(local_data, remote_data, force=False, override_max_width=None, override_quality=None):
    print("Processing Local Images...")
    remote_map = {item['id']: item for item in remote_data if 'id' in item}
    sizes_config = get_image_sizes_config()

    for item in local_data:
        if item.get('id') in remote_map:
            remote_item = remote_map[item['id']]
            event_name = sanitize_filename(item.get('event_name', 'unknown'))

            # Identify the master image URL (usually 'image' field from remote)
            remote_url = remote_item.get('image')

            if not remote_url or not isinstance(remote_url, str) or not remote_url.startswith(('http://', 'https://')):
                # Fallback: try to find any image url if main 'image' is missing
                print(f"No master image found for {item.get('event_name')}, skipping.")
                continue

            # Check if we need to process this item (if any target field is missing or force is True)
            needs_processing = force
            if not needs_processing:
                for size_conf in sizes_config:
                    if not item.get(size_conf['id']):
                        needs_processing = True
                        break

            if not needs_processing:
                continue

            print(f"Processing images for {item.get('event_name', 'Unknown')}...")

            # Download master image to tmp
            ext = os.path.splitext(remote_url.split("?")[0])[1]
            if not ext: ext = ".jpg" # fallback

            master_tmp_path = os.path.join(TMP_DIR, f"master_{item['id']}{ext}")

            try:
                subprocess.run([WGET_BIN, "-O", master_tmp_path, remote_url], check=True)

                if os.path.exists(master_tmp_path):

                    # Generate each size
                    for size_conf in sizes_config:
                        # Determine compression
                        quality = int(size_conf.get('compress', COMPRESS_WEBP))
                        if override_quality:
                            quality = override_quality

                        # Determine suffix
                        suffix = ""
                        if size_conf['id'] == 'image':
                            suffix = ".webp"
                        else:
                            # e.g. image_thumbnail -> .thumbnail.webp
                            suffix = "." + size_conf['id'].replace("image_", "") + ".webp"

                        dest_filename = f"{event_name}{suffix}"
                        dest_path = os.path.join(IMAGES_DIR, dest_filename)

                        try:
                            with Image.open(master_tmp_path) as img:
                                # Apply Actions
                                actions = size_conf.get('action', [])

                                # 1. Resize
                                if 'resize' in actions:
                                    target_width = size_conf.get('width')
                                    target_height = size_conf.get('height')
                                    max_width_conf = size_conf.get('max-width')
                                    max_height_conf = size_conf.get('max-height')

                                    # Override logic
                                    if override_max_width:
                                        max_width_conf = override_max_width

                                    # Convert strings to int/float if necessary, handle "auto"
                                    # Logic:
                                    # If 'crop' is NOT in action, we just resize to fit within max boundaries (thumbnail behavior usually implies crop, but here we separate)
                                    # If 'crop' IS in action, we usually resize to cover the target dimensions first.

                                    new_w, new_h = img.width, img.height

                                    if 'crop' in actions:
                                        # Resize for Crop (Cover strategy)
                                        # We need to ensure the image covers the target width/height
                                        # Assuming width/height are set for crop
                                        req_w = int(size_conf.get('width', 0))
                                        req_h = int(size_conf.get('height', 0))

                                        if req_w > 0 and req_h > 0:
                                            ratio_img = img.width / img.height
                                            ratio_req = req_w / req_h

                                            # If image is wider than target ratio, height is the constraint
                                            if ratio_img > ratio_req:
                                                resize_h = req_h
                                                resize_w = int(resize_h * ratio_img)
                                            else:
                                                resize_w = req_w
                                                resize_h = int(resize_w / ratio_img)

                                            img = img.resize((resize_w, resize_h), Image.Resampling.LANCZOS)
                                            # print(f"  Resized for crop to {resize_w}x{resize_h}")

                                    else:
                                        # Standard Resize (Contain strategy)
                                        # Respect max-width / max-height

                                        # Max Width
                                        mw = None
                                        if max_width_conf and str(max_width_conf).lower() != 'auto':
                                            mw = int(max_width_conf)

                                        # Max Height
                                        mh = None
                                        if max_height_conf and str(max_height_conf).lower() != 'auto':
                                            mh = int(max_height_conf)

                                        # Exact Width/Height (if provided instead of max)
                                        ew = None
                                        if 'width' in size_conf and str(size_conf['width']).lower() != 'auto':
                                            ew = int(size_conf['width'])

                                        # Logic: mostly we use max-width.

                                        if mw and img.width > mw:
                                            ratio = img.height / img.width
                                            new_h = int(mw * ratio)
                                            img = img.resize((mw, new_h), Image.Resampling.LANCZOS)
                                            # print(f"  Resized (max-width) to {mw}x{new_h}")
                                        elif ew and img.width != ew:
                                             ratio = img.height / img.width
                                             new_h = int(ew * ratio)
                                             img = img.resize((ew, new_h), Image.Resampling.LANCZOS)


                                # 2. Crop
                                if 'crop' in actions:
                                    req_w = int(size_conf.get('width', 0))
                                    req_h = int(size_conf.get('height', 0))

                                    if req_w > 0 and req_h > 0:
                                        # Center crop by default (or read crop_x, crop_y)
                                        # Current config says "center", "center"
                                        # We can assume center for now as logic for custom x/y percentages is complex without data

                                        curr_w, curr_h = img.width, img.height

                                        left = (curr_w - req_w) / 2
                                        top = (curr_h - req_h) / 2
                                        right = (curr_w + req_w) / 2
                                        bottom = (curr_h + req_h) / 2

                                        img = img.crop((left, top, right, bottom))
                                        # print(f"  Cropped to {req_w}x{req_h}")

                                img.save(dest_path, "WEBP", quality=quality)

                            # Update local data
                            item[size_conf['id']] = f"data/{YEAR}/images/{dest_filename}"
                            # print(f"  Saved {dest_filename} ({quality}%)")

                        except Exception as e:
                            print(f"  Failed to process {size_conf['id']}: {e}")

            except subprocess.CalledProcessError as e:
                print(f"Failed to download master image {remote_url}: {e}")
            except FileNotFoundError:
                print(f"wget binary not found at {WGET_BIN}")
            finally:
                if os.path.exists(master_tmp_path):
                    os.remove(master_tmp_path)

if __name__ == "__main__":
    main()
