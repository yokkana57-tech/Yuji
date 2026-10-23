#!/usr/bin/env python3
"""WINDY のデザイン画像を Printful 入稿用 PNG にするスクリプト。

使い方:
  python3 windy/tools/prepare_print.py 元画像のパス
  python3 windy/tools/prepare_print.py 元画像のパス --mono   # 線を真っ黒1色にする

やること:
  1. 画像の診断（解像度・ぼやけ・影）を表示する
  2. 紙の白い背景を透明にする（影のムラもなるべく消す）
  3. 半透明のピクセルを無くす（Printful は半透明を避けるよう案内している）
  4. 印刷範囲 15x18 インチに収まる大きさ・300dpi に拡大して保存する
元の画像は上書きしない。出力は windy/design/print/ に別名で保存する。
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageCms, ImageFilter, ImageOps

# Printful の DTG 印刷範囲（新しい標準）15x18 インチ。300dpi で 4500x5400px
AREA_IN = (15, 18)
DPI = 300
TARGET = (AREA_IN[0] * DPI, AREA_IN[1] * DPI)


def laplacian_var(gray):
    """ぼやけ具合の目安。数字が小さいほどぼやけている。"""
    g = gray.astype(np.float32)
    lap = (-4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:])
    return float(lap.var())


def diagnose(img):
    w, h = img.size
    gray = np.asarray(img.convert("L"))
    small = img.convert("L")
    small.thumbnail((1500, 1500))
    sharp = laplacian_var(np.asarray(small))
    # 四隅の明るさの差 → 影やムラ
    k = max(10, min(w, h) // 20)
    corners = [gray[:k, :k], gray[:k, -k:], gray[-k:, :k], gray[-k:, -k:]]
    cm = [float(c.mean()) for c in corners]
    print("=== 診断 ===")
    print(f"大きさ: {w} x {h} px")
    for dpi in (150, 300):
        print(f"  {dpi}dpi なら印刷サイズは 約{w / dpi * 2.54:.1f} x {h / dpi * 2.54:.1f} cm")
    print(f"  15x18インチ(約38x46cm)いっぱいに 300dpi で刷るには {TARGET[0]} x {TARGET[1]} px 必要")
    if max(w / TARGET[0], h / TARGET[1]) < 0.5:
        print("  → 元の画素が足りない。拡大はできるが、ぼやけは直らない（下の改善案を参照）")
    print(f"くっきり度(大きいほどくっきり): {sharp:.0f}  ", end="")
    print("→ ぼやけ気味" if sharp < 100 else "→ おおむね良好")
    print(f"四隅の明るさ: {', '.join(f'{c:.0f}' for c in cm)} (0=黒,255=白)")
    if max(cm) - min(cm) > 25:
        print("  → 影・明るさのムラあり。背景を透明にするとき汚れが残りやすい")
    if min(cm) < 200:
        print("  → 背景が白くない。紙が灰色っぽく写っている可能性")
    print("============")


def remove_background(img, strength):
    """紙の背景（白）を透明にする。影のムラを割り算でならしてから判定する。"""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    # 大きくぼかした画像 = 紙の明るさ（影込み）の推定
    radius = max(15, min(img.size) // 25)
    paper = np.asarray(img.convert("RGB").filter(ImageFilter.MaxFilter(9))
                       .filter(ImageFilter.GaussianBlur(radius))).astype(np.float32)
    flat = np.clip(rgb / np.maximum(paper, 1) * 255, 0, 255)
    # 白からの距離で「インク」かどうかを判定
    darkness = 255 - flat.min(axis=2)
    sat = flat.max(axis=2) - flat.min(axis=2)
    ink = (darkness > strength) | (sat > strength * 1.2)
    mask = Image.fromarray((ink * 255).astype(np.uint8))
    mask = mask.filter(ImageFilter.MedianFilter(3))  # 小さなゴミを消す
    mask = mask.filter(ImageFilter.MinFilter(3))  # 線のふちに残る白いにじみを1px削る
    return Image.fromarray(flat.astype(np.uint8)), mask


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("--strength", type=int, default=60,
                   help="背景判定のしきい値。ゴミが残るなら大きく、線が消えるなら小さく (初期値 60)")
    p.add_argument("--mono", action="store_true", help="線をすべて黒1色にする")
    p.add_argument("--out", default=None)
    a = p.parse_args()

    src = os.path.abspath(a.src)
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    diagnose(img)

    if a.strength < 0:
        sys.exit("strength は 0 以上にしてください")
    flat, mask = remove_background(img, a.strength)
    if a.mono:
        flat = Image.new("RGB", img.size, (0, 0, 0))

    bbox = mask.getbbox()
    if not bbox:
        sys.exit("絵が見つかりませんでした。--strength を小さくして試してください")
    pad = 20
    bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
            min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad))
    flat, mask = flat.crop(bbox), mask.crop(bbox)

    # 印刷範囲に収まる最大サイズへ拡大（縦横比はそのまま）
    scale = min(TARGET[0] / flat.width, TARGET[1] / flat.height)
    size = (round(flat.width * scale), round(flat.height * scale))
    flat = flat.resize(size, Image.LANCZOS)
    mask = mask.resize(size, Image.LANCZOS).point(lambda v: 255 if v >= 128 else 0)

    out = flat.convert("RGBA")
    out.putalpha(mask)
    srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()

    base = os.path.splitext(os.path.basename(src))[0]
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "..", "design", "print")
    os.makedirs(out_dir, exist_ok=True)
    dst = a.out or os.path.join(out_dir, f"{base}_print_{DPI}dpi.png")
    if os.path.abspath(dst) == src:
        sys.exit("元画像と同じ名前には保存しません")
    out.save(dst, dpi=(DPI, DPI), icc_profile=srgb, optimize=True)

    # 確認用: 白Tに乗せたイメージと、灰色背景（透明のゴミが見つけやすい）
    for name, color in (("on_white", (255, 255, 255)), ("on_gray", (128, 128, 128))):
        prev = Image.new("RGB", out.size, color)
        prev.paste(out, mask=out.split()[3])
        prev.thumbnail((1200, 1200))
        prev.save(os.path.join(os.path.dirname(os.path.abspath(dst)), f"{base}_preview_{name}.jpg"), quality=85)

    print(f"保存: {os.path.normpath(dst)}")
    print(f"  {size[0]} x {size[1]} px / {DPI}dpi / 約{size[0]/DPI*2.54:.1f} x {size[1]/DPI*2.54:.1f} cm")
    print(f"  拡大率 {scale:.2f} 倍" + ("（2倍超: ぼやけが目立つ可能性。描き直し・トレースを推奨）" if scale > 2 else ""))
    print("確認用プレビューも同じフォルダに保存しました (_preview_on_gray は灰色背景でゴミ確認用)")


if __name__ == "__main__":
    main()
