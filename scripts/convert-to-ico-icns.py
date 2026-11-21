import os
import shutil
from PIL import Image, IcoImagePlugin, IcnsImagePlugin

Image.init()

brand_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'brand')
public_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public')

# Load the rendered high-res icon PNG
icon_512_path = os.path.join(brand_dir, 'icon-512.png')
if not os.path.exists(icon_512_path):
    print("icon-512.png not found!")
    exit(1)

base_img = Image.open(icon_512_path)

# 1. Generate favicon.ico (16, 32, 48)
favicon_path = os.path.join(brand_dir, 'favicon.ico')
favicon_public_path = os.path.join(public_dir, 'favicon.ico')
base_img.save(favicon_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
shutil.copyfile(favicon_path, favicon_public_path)
print(f"Generated favicon.ico (16, 32, 48)")

# 2. Generate desktop app icon.ico (16, 24, 32, 48, 64, 128, 256)
desktop_ico_path = os.path.join(brand_dir, 'icon.ico')
desktop_ico_public_path = os.path.join(public_dir, 'icon.ico')
base_img.save(desktop_ico_path, format='ICO', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
shutil.copyfile(desktop_ico_path, desktop_ico_public_path)
print(f"Generated desktop icon.ico (16 to 256px)")

# 3. Generate icon.icns (macOS)
icns_path = os.path.join(brand_dir, 'icon.icns')
try:
    base_img.save(icns_path, format='ICNS')
    print(f"Generated icon.icns (macOS)")
except Exception as e:
    print(f"ICNS generation error: {e}")

print("All icon conversions complete.")
