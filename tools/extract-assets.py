from collections import deque
import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source"
SPRITES = ROOT / "assets" / "sprites"
EFFECTS = ROOT / "assets" / "effects"


def remove_sheet_background(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue

            is_white_sheet = r > 250 and g > 250 and b > 250
            is_white_edge = r > 245 and g > 245 and b > 245
            is_green_key = g > 145 and g > r * 1.2 and g > b * 1.2
            is_green_edge = g > 85 and r < 170 and b < 170 and g > r * 1.1 and g > b * 1.1

            if is_white_sheet or is_green_key or is_green_edge:
                pixels[x, y] = (255, 255, 255, 0)
            elif is_white_edge:
                pixels[x, y] = (r, g, b, int(a * 0.35))
            elif g > r * 1.18 and g > b * 1.18 and g > 100:
                # Despill chroma-key remnants without touching the blue suit.
                pixels[x, y] = (r, min(g, max(r, b) + 18), b, a)

    return rgba


def trim_alpha(img: Image.Image, pad: int = 10) -> Image.Image:
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return img

    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(img.width, bbox[2] + pad)
    bottom = min(img.height, bbox[3] + pad)
    return img.crop((left, top, right, bottom))


def cell_bbox(sheet: Image.Image, row: int, col: int, rows: int = 4, cols: int = 4) -> tuple[int, int, int, int]:
    cell_w = sheet.width / cols
    cell_h = sheet.height / rows
    return (
        int(col * cell_w),
        int(row * cell_h),
        int((col + 1) * cell_w),
        int((row + 1) * cell_h),
    )


def crop_grid(sheet_name: str, exports: dict[str, tuple[int, int]], rows: int = 4, cols: int = 4) -> None:
    sheet = Image.open(SOURCE / sheet_name)
    for name, (row, col) in exports.items():
        crop = sheet.crop(cell_bbox(sheet, row, col, rows=rows, cols=cols))
        crop = trim_alpha(remove_sheet_background(crop), pad=12)
        crop.save(SPRITES / f"{name}.png")


def crop_manual(sheet_name: str, exports: dict[str, tuple[int, int, int, int]]) -> None:
    sheet = Image.open(SOURCE / sheet_name)
    for name, bbox in exports.items():
        crop = sheet.crop(bbox)
        crop = trim_alpha(remove_sheet_background(crop), pad=12)
        crop.save(SPRITES / f"{name}.png")


def crop_portrait(name: str, bbox: tuple[int, int, int, int]) -> None:
    img = Image.open(SOURCE / "character-reference.png").convert("RGBA")
    img.crop(bbox).save(SPRITES / f"{name}.png")


def remove_reference_background(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    seen: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        r, g, b, a = pixels[x, y]
        return a > 0 and r > 222 and g > 218 and b > 205 and max(r, g, b) - min(r, g, b) < 42

    for x in range(width):
        for y in (0, height - 1):
            if is_background(x, y):
                queue.append((x, y))
                seen.add((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if (x, y) not in seen and is_background(x, y):
                queue.append((x, y))
                seen.add((x, y))

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height or (nx, ny) in seen:
                continue
            if is_background(nx, ny):
                seen.add((nx, ny))
                queue.append((nx, ny))

    return rgba


def crop_reference_pose(sheet: Image.Image, bbox: tuple[int, int, int, int]) -> Image.Image:
    return trim_alpha(remove_reference_background(sheet.crop(bbox)), pad=14)


def draw_thick_line(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: tuple[int, int, int, int], width: int) -> None:
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in points:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_limb(
    draw: ImageDraw.ImageDraw,
    joints: list[tuple[int, int]],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int],
    width: int,
) -> None:
    draw_thick_line(draw, joints, outline, width + 8)
    draw_thick_line(draw, joints, fill, width)


def draw_hand(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    skin = (246, 176, 122, 255)
    outline = (36, 24, 18, 255)
    draw.ellipse((x - 14, y - 14, x + 14, y + 14), fill=outline)
    draw.ellipse((x - 10, y - 11, x + 11, y + 10), fill=skin)


def draw_shoe(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    outline = (30, 22, 18, 255)
    leather = (105, 58, 29, 255)
    sole = (48, 32, 23, 255)
    draw.ellipse((x - 18, y - 10, x + 24, y + 11), fill=outline)
    draw.ellipse((x - 14, y - 8, x + 18, y + 7), fill=leather)
    draw.polygon([(x + 10, y - 6), (x + 36, y - 2), (x + 32, y + 9), (x + 9, y + 9)], fill=outline)
    draw.polygon([(x + 7, y - 5), (x + 30, y - 1), (x + 27, y + 6), (x + 7, y + 7)], fill=leather)
    draw.rectangle((x - 14, y + 6, x + 34, y + 12), fill=sole)


def draw_runner_head(draw: ImageDraw.ImageDraw) -> None:
    outline = (25, 21, 22, 255)
    skin = (248, 190, 139, 255)
    hair = (27, 29, 32, 255)
    x, y = 190, 84

    draw.ellipse((x - 42, y - 42, x + 42, y + 40), fill=outline)
    draw.ellipse((x - 37, y - 35, x + 39, y + 37), fill=skin)
    draw.polygon([(x - 43, y - 32), (x - 15, y - 58), (x + 25, y - 52), (x + 45, y - 26), (x + 10, y - 20)], fill=hair)
    for ox, oy in [(-35, -26), (-22, -43), (-4, -53), (14, -47), (30, -34)]:
        draw.polygon([(x + ox, y + oy), (x + ox + 20, y + oy + 24), (x + ox - 5, y + oy + 18)], fill=hair)

    draw.ellipse((x + 17, y - 11, x + 39, y + 10), fill=(255, 255, 255, 255), outline=outline, width=3)
    draw.ellipse((x + 29, y - 4, x + 36, y + 5), fill=outline)
    draw.arc((x + 16, y + 12, x + 48, y + 37), 190, 345, fill=outline, width=5)
    draw.arc((x + 3, y - 20, x + 34, y - 3), 200, 345, fill=outline, width=4)
    draw.polygon([(x + 42, y + 5), (x + 56, y + 13), (x + 42, y + 18)], fill=skin, outline=outline)
    draw.ellipse((x - 14, y + 3, x - 4, y + 14), fill=(79, 175, 232, 255))
    draw.ellipse((x - 2, y + 18, x + 8, y + 29), fill=(79, 175, 232, 255))


def draw_runner_torso(draw: ImageDraw.ImageDraw) -> None:
    outline = (14, 26, 44, 255)
    suit = (10, 45, 88, 255)
    suit_light = (19, 70, 122, 255)
    shirt = (250, 249, 242, 255)
    tie = (15, 81, 155, 255)

    body = [(132, 134), (198, 126), (222, 218), (152, 236), (104, 174)]
    draw.polygon(body, fill=outline)
    draw.polygon([(138, 139), (194, 132), (215, 214), (154, 229), (112, 174)], fill=suit)
    draw.polygon([(153, 142), (185, 139), (193, 211), (165, 221), (143, 171)], fill=shirt)
    draw.polygon([(169, 145), (185, 178), (179, 222), (160, 180)], fill=tie)
    draw.line((112, 174, 154, 229), fill=suit_light, width=4)
    draw.line((198, 132, 215, 214), fill=suit_light, width=4)


def make_grounded_player_run_cycle() -> None:
    outline = (18, 22, 28, 255)
    near = (9, 43, 84, 255)
    far = (34, 78, 126, 255)
    skin = (246, 176, 122, 255)
    shirt = (248, 249, 244, 255)
    tie = (16, 84, 164, 255)
    shoe = (105, 58, 29, 255)
    scale = 5
    poses = [
        {
            "bob": 0,
            "far_arm": [(29, 30), (21, 35), (15, 43)],
            "near_arm": [(33, 29), (44, 35), (52, 42)],
            "far_leg": [(29, 39), (42, 48), (54, 58)],
            "near_leg": [(31, 39), (22, 48), (12, 58)],
        },
        {
            "bob": -1,
            "far_arm": [(29, 30), (28, 38), (24, 45)],
            "near_arm": [(33, 29), (35, 37), (31, 44)],
            "far_leg": [(29, 39), (30, 49), (35, 58)],
            "near_leg": [(31, 39), (32, 50), (30, 58)],
        },
        {
            "bob": 0,
            "far_arm": [(29, 30), (41, 35), (50, 42)],
            "near_arm": [(33, 29), (24, 34), (17, 43)],
            "far_leg": [(29, 39), (20, 48), (12, 58)],
            "near_leg": [(31, 39), (43, 48), (55, 58)],
        },
        {
            "bob": -1,
            "far_arm": [(29, 30), (31, 38), (36, 45)],
            "near_arm": [(33, 29), (32, 37), (36, 44)],
            "far_leg": [(29, 39), (28, 50), (25, 58)],
            "near_leg": [(31, 39), (30, 50), (35, 58)],
        },
    ]

    def shifted(points: list[tuple[int, int]], dy: int) -> list[tuple[int, int]]:
        return [(x, y + dy) for x, y in points]

    def pixel_line(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: tuple[int, int, int, int], width: int) -> None:
        draw.line(points, fill=fill, width=width)
        radius = max(1, width // 2)
        for x, y in points:
            draw.rectangle((x - radius, y - radius, x + radius, y + radius), fill=fill)

    def pixel_limb(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: tuple[int, int, int, int], width: int) -> None:
        pixel_line(draw, points, outline, width + 2)
        pixel_line(draw, points, fill, width)

    def hand(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
        draw.rectangle((x - 2, y - 2, x + 2, y + 2), fill=outline)
        draw.rectangle((x - 1, y - 1, x + 2, y + 2), fill=skin)

    def foot(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
        draw.rectangle((x - 3, y - 2, x + 6, y + 1), fill=outline)
        draw.rectangle((x - 2, y - 3, x + 4, y), fill=shoe)
        draw.rectangle((x - 1, y + 1, x + 7, y + 2), fill=outline)

    def head(draw: ImageDraw.ImageDraw, dy: int) -> None:
        draw.ellipse((25, 8 + dy, 45, 28 + dy), fill=outline)
        draw.ellipse((27, 10 + dy, 45, 29 + dy), fill=skin)
        draw.polygon([(23, 9 + dy), (30, 4 + dy), (42, 6 + dy), (46, 13 + dy), (35, 12 + dy)], fill=outline)
        draw.rectangle((40, 17 + dy, 44, 20 + dy), fill=(255, 255, 255, 255))
        draw.rectangle((42, 18 + dy, 43, 20 + dy), fill=outline)
        draw.rectangle((44, 22 + dy, 50, 23 + dy), fill=outline)
        draw.rectangle((22, 18 + dy, 24, 21 + dy), fill=(78, 174, 232, 255))
        draw.rectangle((25, 23 + dy, 26, 26 + dy), fill=(78, 174, 232, 255))

    def torso(draw: ImageDraw.ImageDraw, dy: int) -> None:
        draw.polygon([(23, 29 + dy), (37, 28 + dy), (43, 45 + dy), (30, 47 + dy), (20, 37 + dy)], fill=outline)
        draw.polygon([(25, 30 + dy), (36, 29 + dy), (41, 44 + dy), (30, 45 + dy), (22, 37 + dy)], fill=near)
        draw.polygon([(30, 30 + dy), (36, 31 + dy), (36, 43 + dy), (31, 44 + dy), (27, 35 + dy)], fill=shirt)
        draw.polygon([(32, 31 + dy), (36, 38 + dy), (34, 45 + dy), (31, 37 + dy)], fill=tie)

    def render_pose(index: int, pose: dict[str, object]) -> None:
        dy = int(pose["bob"])
        img = Image.new("RGBA", (64, 64), (255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse((16, 58, 50, 62), fill=(0, 0, 0, 40))

        pixel_limb(draw, shifted(pose["far_leg"], dy), far, 3)
        foot(draw, *shifted([pose["far_leg"][-1]], dy)[0])
        pixel_limb(draw, shifted(pose["far_arm"], dy), far, 2)
        hand(draw, *shifted([pose["far_arm"][-1]], dy)[0])
        torso(draw, dy)
        head(draw, dy)
        pixel_limb(draw, shifted(pose["near_leg"], dy), near, 4)
        foot(draw, *shifted([pose["near_leg"][-1]], dy)[0])
        pixel_limb(draw, shifted(pose["near_arm"], dy), near, 3)
        hand(draw, *shifted([pose["near_arm"][-1]], dy)[0])

        scaled = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)
        trim_alpha(scaled, pad=8).save(SPRITES / f"player-run-{index}.png")

    for index, pose in enumerate(poses, start=1):
        render_pose(index, pose)


def make_directional_player_fallbacks() -> None:
    pose_sources = {
        "idle": "player-idle.png",
        "run-1": "player-run-1.png",
        "run-2": "player-run-2.png",
        "run-3": "player-run-3.png",
        "run-4": "player-run-4.png",
        "limit": "player-limit.png",
        "fall": "player-fall.png",
    }

    for pose, source_name in pose_sources.items():
        source = Image.open(SPRITES / source_name).convert("RGBA")
        source.save(SPRITES / f"player-right-{pose}.png")
        source.transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(SPRITES / f"player-left-{pose}.png")
        # Baseline placeholders. The supplied character reference below
        # overwrites front/back when those crops are available.
        source.save(SPRITES / f"player-back-{pose}.png")
        source.save(SPRITES / f"player-front-{pose}.png")

    reference_path = SOURCE / "character-reference.png"
    if not reference_path.exists():
        return

    reference = Image.open(reference_path).convert("RGBA")
    front = crop_reference_pose(reference, (46, 245, 274, 848))
    three_quarter = crop_reference_pose(reference, (322, 238, 552, 848))
    fall = Image.open(SPRITES / "player-fall.png").convert("RGBA")

    for pose in ("idle", "run-1", "run-2", "run-3", "run-4", "limit"):
        front.save(SPRITES / f"player-front-{pose}.png")
        # The source sheet has no true rear view yet. Use the supplied 3/4 pose
        # as the back-facing placeholder until a rear sprite is generated.
        three_quarter.save(SPRITES / f"player-back-{pose}.png")

    for direction in ("front", "back", "right", "left"):
        fall.save(SPRITES / f"player-{direction}-fall.png")


def make_stain() -> None:
    size = 320
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    cx, cy = 150, 162
    blobs = [
        (0, 0, 72, 42, (92, 48, 20, 218)),
        (40, -10, 46, 30, (128, 73, 30, 188)),
        (-38, 14, 44, 34, (105, 57, 26, 202)),
        (10, 40, 38, 52, (72, 39, 19, 160)),
        (-10, -34, 36, 24, (150, 88, 38, 132)),
    ]

    for y in range(size):
        for x in range(size):
            color = None
            alpha = 0
            for ox, oy, rx, ry, fill in blobs:
                dx = (x - (cx + ox)) / rx
                dy = (y - (cy + oy)) / ry
                d = dx * dx + dy * dy
                if d <= 1:
                    edge = max(0, min(1, 1 - d))
                    local_alpha = int(fill[3] * (0.3 + edge * 0.7))
                    if local_alpha > alpha:
                        color = fill
                        alpha = local_alpha

            if color:
                r, g, b, _ = color
                px[x, y] = (r, g, b, alpha)

    img = img.filter(ImageFilter.GaussianBlur(radius=1.2))
    img.save(EFFECTS / "brown-stain.png")


def make_generated_player_4dir_sprites() -> None:
    generator_path = Path(__file__).with_name("generate_player_4dir_sprites.py")
    if not generator_path.exists():
        return

    spec = importlib.util.spec_from_file_location("generate_player_4dir_sprites", generator_path)
    if spec is None or spec.loader is None:
        return

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.save_sprites(SPRITES)


def main() -> None:
    SPRITES.mkdir(parents=True, exist_ok=True)
    EFFECTS.mkdir(parents=True, exist_ok=True)

    player_sheet_v5 = SOURCE / "player-sheet-v5.png"
    player_sheet_v4 = SOURCE / "player-sheet-v4.png"
    player_sheet_v3 = SOURCE / "player-sheet-v3.png"
    player_sheet_v2 = SOURCE / "player-sheet-v2.png"
    if player_sheet_v5.exists() or player_sheet_v4.exists() or player_sheet_v3.exists() or player_sheet_v2.exists():
        crop_grid(
            "player-sheet-v5.png" if player_sheet_v5.exists() else "player-sheet-v4.png" if player_sheet_v4.exists() else "player-sheet-v3.png" if player_sheet_v3.exists() else "player-sheet-v2.png",
            {
                "player-idle": (0, 0),
                "player-run-1": (0, 1),
                "player-run-2": (0, 2),
                "player-run-3": (1, 0),
                "player-run-4": (1, 1),
                "player-move-up": (1, 2),
                "player-move-down": (2, 0),
                "player-fall": (2, 1),
                "player-limit": (2, 2),
            },
            rows=3,
            cols=3,
        )
    else:
        crop_manual(
            "player-sheet.png",
            {
                "player-idle": (55, 18, 260, 340),
                "player-run-1": (20, 330, 315, 635),
                "player-run-2": (325, 330, 620, 635),
                "player-run-3": (635, 330, 935, 635),
                "player-run-4": (940, 330, 1242, 635),
                "player-move-up": (920, 640, 1212, 920),
                "player-move-down": (28, 640, 315, 920),
                "player-fall": (305, 925, 625, 1228),
                "player-limit": (935, 925, 1232, 1238),
            },
        )

    commuter_sheet_v2 = SOURCE / "commuter-sheet-v2.png"
    crop_grid(
        "commuter-sheet-v2.png" if commuter_sheet_v2.exists() else "commuter-sheet.png",
        {
            "enemy-business-1": (0, 0),
            "enemy-business-2": (0, 1),
            "enemy-business-3": (0, 2),
            "enemy-business-front": (0, 3),
            "enemy-ol-1": (1, 0),
            "enemy-ol-2": (1, 1),
            "enemy-ol-3": (1, 2),
            "enemy-ol-front": (1, 3),
            "enemy-student-1": (2, 0),
            "enemy-student-2": (2, 1),
            "enemy-student-3": (2, 2),
            "enemy-student-front": (2, 3),
            "enemy-traveler-1": (3, 0),
            "enemy-traveler-2": (3, 1),
            "enemy-traveler-3": (3, 2),
            "enemy-traveler-front": (3, 3),
        },
    )

    crop_portrait("face-normal", (860, 200, 1090, 430))
    crop_portrait("face-panic", (850, 485, 1094, 704))
    crop_portrait("face-limit", (835, 774, 1098, 990))
    if (SOURCE / "player-4dir-generated-sheet.png").exists():
        make_generated_player_4dir_sprites()
    else:
        make_grounded_player_run_cycle()
        make_directional_player_fallbacks()
    make_stain()


if __name__ == "__main__":
    main()
