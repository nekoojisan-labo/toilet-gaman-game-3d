from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "sprites"
SIZE = 80
FRAME_COUNT = 4

OUTLINE = (39, 31, 35, 255)
HAIR = (31, 32, 34, 255)
HAIR_LIGHT = (72, 70, 67, 255)
SKIN = (238, 176, 126, 255)
SKIN_DARK = (187, 111, 75, 255)
SUIT = (15, 43, 82, 255)
SUIT_LIGHT = (32, 74, 127, 255)
SUIT_DARK = (8, 25, 50, 255)
SHIRT = (242, 240, 225, 255)
TIE = (27, 105, 184, 255)
SHOE = (91, 52, 29, 255)
SWEAT = (114, 211, 248, 255)
BLUSH = (221, 101, 92, 255)
MOUTH = (103, 37, 34, 255)


def rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill, outline=OUTLINE) -> None:
    draw.rectangle(box, fill=fill, outline=outline)


def px(draw: ImageDraw.ImageDraw, x: int, y: int, color, w: int = 1, h: int = 1) -> None:
    draw.rectangle((x, y, x + w - 1, y + h - 1), fill=color)


def flip_x(img: Image.Image) -> Image.Image:
    return img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


def draw_sweat(draw: ImageDraw.ImageDraw, x: int, y: int, mirror: bool = False) -> None:
    offsets = [(-2, 0), (2, 4), (-5, 7)] if not mirror else [(2, 0), (-2, 4), (5, 7)]
    for ox, oy in offsets:
        px(draw, x + ox, y + oy, SWEAT, 2, 3)
        px(draw, x + ox + 1, y + oy - 1, (202, 244, 255, 255), 1, 1)


def draw_front_head(draw: ImageDraw.ImageDraw, x: int, y: int, back: bool, limit: bool = False) -> None:
    rect(draw, (x - 12, y - 2, x + 12, y + 20), SKIN if not back else HAIR)
    px(draw, x - 15, y + 3, SKIN_DARK if not back else HAIR, 4, 8)
    px(draw, x + 12, y + 3, SKIN_DARK if not back else HAIR, 4, 8)

    hair = [
        (x - 14, y - 5, 5, 8),
        (x - 9, y - 8, 5, 9),
        (x - 3, y - 7, 6, 7),
        (x + 4, y - 8, 5, 9),
        (x + 10, y - 4, 5, 8),
    ]
    for hx, hy, hw, hh in hair:
        px(draw, hx, hy, HAIR, hw, hh)
    px(draw, x - 8, y - 1, HAIR_LIGHT, 3, 1)
    px(draw, x + 4, y - 1, HAIR_LIGHT, 3, 1)

    if back:
        px(draw, x - 8, y + 12, HAIR_LIGHT, 16, 1)
        return

    px(draw, x - 7, y + 6, (255, 255, 255, 255), 5, 5)
    px(draw, x + 3, y + 6, (255, 255, 255, 255), 5, 5)
    px(draw, x - 5, y + 8, OUTLINE, 2, 3)
    px(draw, x + 4, y + 8, OUTLINE, 2, 3)
    px(draw, x - 6, y + 16, MOUTH, 12, 5)
    px(draw, x - 10, y + 13, BLUSH, 4, 3)
    px(draw, x + 7, y + 13, BLUSH, 4, 3)
    if limit:
        px(draw, x - 10, y + 3, (190, 58, 50, 120), 20, 14)
    draw_sweat(draw, x + 18, y + 4)
    draw_sweat(draw, x - 18, y + 5, mirror=True)


def draw_side_head_left(draw: ImageDraw.ImageDraw, x: int, y: int, limit: bool = False) -> None:
    rect(draw, (x - 13, y - 2, x + 11, y + 20), SKIN)
    px(draw, x - 16, y + 7, SKIN, 5, 7)
    px(draw, x - 17, y + 11, OUTLINE, 2, 3)
    for hx, hy, hw, hh in [
        (x - 12, y - 7, 5, 8),
        (x - 7, y - 9, 6, 9),
        (x, y - 8, 7, 8),
        (x + 7, y - 5, 6, 8),
        (x + 8, y + 1, 5, 12),
    ]:
        px(draw, hx, hy, HAIR, hw, hh)
    px(draw, x - 8, y + 7, (255, 255, 255, 255), 5, 5)
    px(draw, x - 7, y + 9, OUTLINE, 2, 3)
    px(draw, x - 14, y + 16, MOUTH, 9, 5)
    px(draw, x + 3, y + 13, BLUSH, 4, 3)
    if limit:
        px(draw, x - 9, y + 3, (190, 58, 50, 120), 16, 14)
    draw_sweat(draw, x + 17, y + 5)


def draw_body_front(draw: ImageDraw.ImageDraw, x: int, y: int, back: bool) -> None:
    rect(draw, (x - 13, y, x + 13, y + 22), SUIT)
    px(draw, x - 11, y + 2, SUIT_LIGHT, 3, 18)
    px(draw, x + 8, y + 2, SUIT_DARK, 3, 18)
    if not back:
        px(draw, x - 5, y + 1, SHIRT, 10, 18)
        px(draw, x - 2, y + 2, TIE, 5, 18)
        px(draw, x - 1, y + 7, (79, 164, 224, 255), 4, 2)


def draw_body_side_left(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rect(draw, (x - 14, y, x + 12, y + 22), SUIT)
    px(draw, x - 10, y + 2, SHIRT, 7, 18)
    px(draw, x - 8, y + 3, TIE, 5, 18)
    px(draw, x + 8, y + 3, SUIT_DARK, 3, 17)


def limb(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color, width: int = 4) -> None:
    draw.line(points, fill=OUTLINE, width=width + 2)
    draw.line(points, fill=color, width=width)


def shoe(draw: ImageDraw.ImageDraw, x: int, y: int, direction: int) -> None:
    px(draw, x - 3 if direction < 0 else x - 1, y, OUTLINE, 9, 5)
    px(draw, x - 2 if direction < 0 else x, y + 1, SHOE, 7, 3)


FRONT_RUN = [
    {
        "bob": 0,
        "l_leg": [(34, 55), (30, 64), (27, 70)],
        "r_leg": [(45, 55), (49, 62), (52, 68)],
        "l_arm": [(29, 39), (23, 45), (20, 52)],
        "r_arm": [(51, 39), (58, 44), (61, 51)],
    },
    {
        "bob": 2,
        "l_leg": [(35, 55), (35, 64), (34, 70)],
        "r_leg": [(45, 55), (45, 64), (46, 70)],
        "l_arm": [(30, 40), (26, 47), (25, 53)],
        "r_arm": [(50, 40), (54, 47), (55, 53)],
    },
    {
        "bob": 0,
        "l_leg": [(35, 55), (31, 62), (28, 68)],
        "r_leg": [(46, 55), (50, 64), (53, 70)],
        "l_arm": [(29, 39), (22, 44), (19, 51)],
        "r_arm": [(51, 39), (57, 45), (60, 52)],
    },
    {
        "bob": 2,
        "l_leg": [(35, 55), (35, 64), (36, 70)],
        "r_leg": [(45, 55), (45, 64), (44, 70)],
        "l_arm": [(30, 40), (26, 47), (25, 53)],
        "r_arm": [(50, 40), (54, 47), (55, 53)],
    },
]

SIDE_RUN_LEFT = [
    {
        "bob": 0,
        "front_leg": [(36, 55), (28, 64), (20, 70)],
        "back_leg": [(45, 55), (55, 62), (62, 68)],
        "front_arm": [(35, 38), (27, 43), (22, 49)],
        "back_arm": [(48, 39), (56, 45), (61, 52)],
    },
    {
        "bob": 2,
        "front_leg": [(36, 55), (34, 63), (31, 70)],
        "back_leg": [(45, 55), (47, 63), (50, 70)],
        "front_arm": [(35, 39), (31, 46), (29, 53)],
        "back_arm": [(48, 40), (52, 47), (54, 53)],
    },
    {
        "bob": 0,
        "front_leg": [(45, 55), (34, 63), (25, 69)],
        "back_leg": [(36, 55), (48, 64), (60, 70)],
        "front_arm": [(48, 38), (40, 44), (34, 50)],
        "back_arm": [(35, 40), (44, 46), (51, 53)],
    },
    {
        "bob": 2,
        "front_leg": [(36, 55), (34, 63), (31, 70)],
        "back_leg": [(45, 55), (47, 63), (50, 70)],
        "front_arm": [(35, 39), (31, 46), (29, 53)],
        "back_arm": [(48, 40), (52, 47), (54, 53)],
    },
]


def shifted(points: list[tuple[int, int]], dy: int) -> list[tuple[int, int]]:
    return [(x, y + dy) for x, y in points]


def draw_front_sprite(frame: int, back: bool = False, limit: bool = False) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    spec = FRONT_RUN[frame]
    bob = spec["bob"]
    draw_body_front(draw, 40, 34 + bob, back)
    limb(draw, shifted(spec["l_leg"], bob), SUIT_DARK, 4)
    limb(draw, shifted(spec["r_leg"], bob), SUIT_LIGHT, 4)
    limb(draw, shifted(spec["l_arm"], bob), SUIT_LIGHT, 4)
    limb(draw, shifted(spec["r_arm"], bob), SUIT_DARK, 4)
    px(draw, spec["l_arm"][-1][0] - 1, spec["l_arm"][-1][1] + bob, SKIN, 4, 4)
    px(draw, spec["r_arm"][-1][0] - 1, spec["r_arm"][-1][1] + bob, SKIN, 4, 4)
    shoe(draw, spec["l_leg"][-1][0], spec["l_leg"][-1][1] + bob, -1)
    shoe(draw, spec["r_leg"][-1][0], spec["r_leg"][-1][1] + bob, 1)
    draw_front_head(draw, 40, 14 + bob, back, limit)
    return img


def draw_side_left_sprite(frame: int, limit: bool = False) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    spec = SIDE_RUN_LEFT[frame]
    bob = spec["bob"]
    draw_body_side_left(draw, 40, 34 + bob)
    limb(draw, shifted(spec["back_leg"], bob), SUIT_DARK, 4)
    limb(draw, shifted(spec["front_leg"], bob), SUIT_LIGHT, 4)
    limb(draw, shifted(spec["back_arm"], bob), SUIT_DARK, 4)
    limb(draw, shifted(spec["front_arm"], bob), SUIT_LIGHT, 4)
    px(draw, spec["front_arm"][-1][0] - 1, spec["front_arm"][-1][1] + bob, SKIN, 4, 4)
    px(draw, spec["back_arm"][-1][0] - 1, spec["back_arm"][-1][1] + bob, SKIN, 4, 4)
    shoe(draw, spec["front_leg"][-1][0], spec["front_leg"][-1][1] + bob, -1)
    shoe(draw, spec["back_leg"][-1][0], spec["back_leg"][-1][1] + bob, 1)
    draw_side_head_left(draw, 38, 14 + bob, limit)
    return img


def make_fall_sprite() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rect(draw, (25, 43, 58, 58), SUIT)
    rect(draw, (39, 34, 62, 54), SKIN)
    px(draw, 41, 39, (255, 255, 255, 255), 5, 5)
    px(draw, 51, 39, (255, 255, 255, 255), 5, 5)
    px(draw, 44, 49, MOUTH, 12, 5)
    px(draw, 37, 30, HAIR, 24, 8)
    limb(draw, [(28, 55), (20, 64), (13, 70)], SUIT_LIGHT, 4)
    limb(draw, [(53, 56), (62, 64), (69, 70)], SUIT_DARK, 4)
    limb(draw, [(29, 44), (19, 40), (12, 36)], SUIT_LIGHT, 4)
    limb(draw, [(55, 45), (66, 42), (72, 38)], SUIT_DARK, 4)
    draw_sweat(draw, 66, 30)
    return img


def save_preview(output_dir: Path) -> None:
    rows = ["front", "back", "left", "right"]
    sheet = Image.new("RGBA", (SIZE * FRAME_COUNT, SIZE * len(rows)), (0, 0, 0, 0))
    checker = Image.new("RGBA", sheet.size, (0, 0, 0, 255))
    draw = ImageDraw.Draw(checker)
    for y in range(0, checker.height, 8):
        for x in range(0, checker.width, 8):
            fill = (228, 228, 228, 255) if ((x // 8) + (y // 8)) % 2 == 0 else (190, 190, 190, 255)
            draw.rectangle((x, y, x + 7, y + 7), fill=fill)

    for row, direction in enumerate(rows):
        for col in range(FRAME_COUNT):
            sprite = Image.open(output_dir / f"player-{direction}-run-{col + 1}.png").convert("RGBA")
            sheet.alpha_composite(sprite, (col * SIZE, row * SIZE))
            checker.alpha_composite(sprite, (col * SIZE, row * SIZE))

    sheet.save(output_dir / "player-4dir-run-preview.png")
    checker.resize((checker.width * 3, checker.height * 3), Image.Resampling.NEAREST).save(
        output_dir / "player-4dir-run-preview-checker.png"
    )


def save_sprites(output_dir: Path = SPRITES) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    fall = make_fall_sprite()
    for index in range(FRAME_COUNT):
        frame_no = index + 1
        front = draw_front_sprite(index, back=False)
        back = draw_front_sprite(index, back=True)
        left = draw_side_left_sprite(index)
        right = flip_x(left)
        front.save(output_dir / f"player-front-run-{frame_no}.png")
        back.save(output_dir / f"player-back-run-{frame_no}.png")
        left.save(output_dir / f"player-left-run-{frame_no}.png")
        right.save(output_dir / f"player-right-run-{frame_no}.png")

    for direction in ("front", "back", "left", "right"):
        Image.open(output_dir / f"player-{direction}-run-2.png").save(output_dir / f"player-{direction}-idle.png")
        if direction == "front":
            limit = draw_front_sprite(1, back=False, limit=True)
        elif direction == "back":
            limit = draw_front_sprite(1, back=True, limit=True)
        elif direction == "left":
            limit = draw_side_left_sprite(1, limit=True)
        else:
            limit = flip_x(draw_side_left_sprite(1, limit=True))
        limit.save(output_dir / f"player-{direction}-limit.png")
        fall.save(output_dir / f"player-{direction}-fall.png")

    Image.open(output_dir / "player-right-idle.png").save(output_dir / "player-idle.png")
    for index in range(FRAME_COUNT):
        Image.open(output_dir / f"player-right-run-{index + 1}.png").save(output_dir / f"player-run-{index + 1}.png")
    Image.open(output_dir / "player-right-limit.png").save(output_dir / "player-limit.png")
    fall.save(output_dir / "player-fall.png")
    save_preview(output_dir)


def main() -> None:
    save_sprites()


if __name__ == "__main__":
    main()
