from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source"
SPRITES = ROOT / "assets" / "sprites"

SOURCE_SHEET = SOURCE / "player-4dir-generated-sheet.png"
SPRITE_SIZE = 192
RUN_FRAME_COUNT = 3
DIRECTIONS = (
    ("front", 0),
    ("back", 1),
    ("left", 2),
    ("right", 3),
)


def remove_green_background(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue

            strong_key = g > 138 and g > r * 1.2 and g > b * 1.2
            soft_key = g > 94 and r < 180 and b < 180 and g > r * 1.08 and g > b * 1.08
            if strong_key or soft_key:
                pixels[x, y] = (255, 255, 255, 0)
                continue

            # Remove green spill while preserving the blue suit.
            if g > max(r, b) + 18:
                pixels[x, y] = (r, max(r, b) + 12, b, a)

    return rgba


def trim_alpha(img: Image.Image, pad: int = 8) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img

    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(img.width, bbox[2] + pad)
    bottom = min(img.height, bbox[3] + pad)
    return img.crop((left, top, right, bottom))


def normalize_sprite(img: Image.Image, size: int = SPRITE_SIZE) -> Image.Image:
    img = trim_alpha(img, pad=10)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    max_w = size - 20
    max_h = size - 12
    scale = min(max_w / img.width, max_h / img.height)
    new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    resized = img.resize(new_size, Image.Resampling.LANCZOS)
    x = (size - resized.width) // 2
    y = size - resized.height - 4
    canvas.alpha_composite(resized, (x, y))
    return canvas


def sheet_cell(sheet: Image.Image, row: int, col: int) -> Image.Image:
    cell_w = sheet.width / RUN_FRAME_COUNT
    cell_h = sheet.height / len(DIRECTIONS)
    bbox = (
        round(col * cell_w),
        round(row * cell_h),
        round((col + 1) * cell_w),
        round((row + 1) * cell_h),
    )
    return sheet.crop(bbox)


def make_limit_sprite(base: Image.Image) -> Image.Image:
    sprite = base.copy()
    alpha = sprite.getchannel("A")
    tint = Image.new("RGBA", sprite.size, (255, 56, 40, 0))
    tint.putalpha(alpha.point(lambda v: int(v * 0.16)))
    sprite.alpha_composite(tint)

    draw = ImageDraw.Draw(sprite)
    draw.ellipse((132, 22, 143, 35), fill=(90, 200, 255, 210))
    draw.ellipse((145, 36, 154, 47), fill=(90, 200, 255, 180))
    return sprite


def make_fall_sprite(base: Image.Image, direction: str) -> Image.Image:
    angle = -18 if direction in ("front", "right") else 18
    rotated = base.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    return normalize_sprite(rotated, size=SPRITE_SIZE)


def save_preview(frames: dict[str, list[Image.Image]], output_dir: Path) -> None:
    cell = SPRITE_SIZE
    preview = Image.new("RGBA", (cell * RUN_FRAME_COUNT, cell * len(DIRECTIONS)), (28, 32, 38, 255))
    draw = ImageDraw.Draw(preview)

    for y in range(0, preview.height, 16):
        for x in range(0, preview.width, 16):
            fill = (40, 45, 54, 255) if ((x // 16) + (y // 16)) % 2 else (31, 36, 44, 255)
            draw.rectangle((x, y, x + 15, y + 15), fill=fill)

    for row, (direction, _) in enumerate(DIRECTIONS):
        for col, frame in enumerate(frames[direction]):
            preview.alpha_composite(frame, (col * cell, row * cell))

    preview.save(output_dir / "player-4dir-run-preview.png")
    preview.save(output_dir / "player-4dir-run-preview-checker.png")

    gif_frames = []
    for col in range(RUN_FRAME_COUNT):
        gif = Image.new("RGBA", (cell, cell * len(DIRECTIONS)), (0, 0, 0, 0))
        for row, (direction, _) in enumerate(DIRECTIONS):
            gif.alpha_composite(frames[direction][col], (0, row * cell))
        gif_frames.append(gif)
    gif_frames[0].save(
        output_dir / "player-4dir-run-preview.gif",
        save_all=True,
        append_images=gif_frames[1:],
        duration=110,
        loop=0,
        disposal=2,
    )


def save_sprites(output_dir: Path = SPRITES) -> None:
    if not SOURCE_SHEET.exists():
        raise FileNotFoundError(f"Missing source sheet: {SOURCE_SHEET}")

    output_dir.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE_SHEET).convert("RGBA")
    frames: dict[str, list[Image.Image]] = {}

    for direction, row in DIRECTIONS:
        direction_frames = []
        for col in range(RUN_FRAME_COUNT):
            sprite = normalize_sprite(remove_green_background(sheet_cell(sheet, row, col)))
            sprite.save(output_dir / f"player-{direction}-run-{col + 1}.png")
            direction_frames.append(sprite)

        idle = direction_frames[1]
        idle.save(output_dir / f"player-{direction}-idle.png")
        make_limit_sprite(idle).save(output_dir / f"player-{direction}-limit.png")
        make_fall_sprite(direction_frames[0], direction).save(output_dir / f"player-{direction}-fall.png")
        frames[direction] = direction_frames

    # Generic fallback assets keep older code paths usable.
    for col, sprite in enumerate(frames["right"], start=1):
        sprite.save(output_dir / f"player-run-{col}.png")
    frames["right"][1].save(output_dir / "player-idle.png")
    make_limit_sprite(frames["front"][1]).save(output_dir / "player-limit.png")
    make_fall_sprite(frames["right"][0], "right").save(output_dir / "player-fall.png")

    save_preview(frames, output_dir)


if __name__ == "__main__":
    save_sprites()
