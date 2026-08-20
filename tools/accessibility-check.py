#!/usr/bin/env python3
# encoding: utf-8
"""心语伴 · 无障碍自检脚本（本地开发用）

检查三件事：
  1) WXML 里绑定的方法，在该页 JS 中是否存在（防手滑写错）
  2) WXSS 中正文/标题字号过小（< 24rpx）的样式提示
  3) WXSS 中 color 文本与其背景色的 WCAG 对比度：
     大文本(≥48rpx)阈值 3.0，普通文本 4.5（参考 WCAG AA）

用法: python3 tools/accessibility-check.py [项目根目录，默认取本脚本上级]
退出码: 0 无问题 · 1 有警告 · 2 有错误
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE_BG = (247, 249, 251)  # app 里常用的 #F7F8FB / #F7F9FB 近似


def rel(path):
    return os.path.relpath(path, ROOT)


def hex2rgb(h):
    h = h.strip().lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None


def _linear(c):
    c /= 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def contrast(a, b):
    la = 0.2126 * _linear(a[0]) + 0.7152 * _linear(a[1]) + 0.0722 * _linear(a[2])
    lb = 0.2126 * _linear(b[0]) + 0.7152 * _linear(b[1]) + 0.0722 * _linear(b[2])
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


def parse_wxss(src):
    blocks = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', src):
        sel = m.group(1).strip()
        if sel.startswith('@'):
            continue
        props = {}
        for p in re.finditer(r'([a-z-]+)\s*:\s*([^;]+);?', m.group(2)):
            props[p.group(1).strip()] = p.group(2).strip()
        if props:
            blocks.append((sel, props))
    return blocks


def main(root):
    errors, warnings = [], []

    # ---- 1) WXML 绑定方法 <-> 页面 JS ----
    for dirpath, _, files in os.walk(os.path.join(root, 'pages')):
        wxml_files = [f for f in files if f.endswith('.wxml')]
        if not wxml_files:
            continue
        js_names = set()
        for jf in files:
            if jf.endswith('.js'):
                js = open(os.path.join(dirpath, jf), encoding='utf-8').read()
                js_names |= set(re.findall(r'^\s{2}(?:async\s+)?([\w$]+)\s*[:(]', js, re.M))
        for fn in wxml_files:
            src = open(os.path.join(dirpath, fn), encoding='utf-8').read()
            for name in re.findall(r'bind[a-z]+\s*=\s*["\']([\w$]+)["\']', src):
                if name not in js_names:
                    errors.append(f"{rel(os.path.join(dirpath, fn))}: 绑定方法 {name} 在该页 JS 中未定义")

    # ---- 2)(3) WXSS 字号与对比度 ----
    for dirpath, _, files in os.walk(os.path.join(root, 'pages')):
        for fn in files:
            if not fn.endswith('.wxss'):
                continue
            full = os.path.join(dirpath, fn)
            for sel, props in parse_wxss(full):
                fs_raw = props.get('font-size', '')
                fs_num = 0.0
                m = re.match(r'([\d.]+)', fs_raw)
                if m:
                    fs_num = float(m.group(1))
                if fs_num and fs_num < 24 and 'rpx' in fs_raw:
                    warnings.append(
                        f"{rel(full)}: 字号过小 <24rpx → {sel} (font-size:{fs_raw})")
                col_raw = props.get('color', '')
                if 'var(' in col_raw or col_raw.startswith('rgb'):
                    continue
                col_rgb = hex2rgb(col_raw)
                if not col_rgb:
                    continue
                bg_raw = props.get('background', '')
                bg_rgb = None
                cands = [hex2rgb(t) for t in re.findall(r'#[0-9a-fA-F]{3,8}', bg_raw)]
                if cands:
                    bg_rgb = cands[0]
                if not bg_rgb:
                    bg_rgb = PAGE_BG
                ratio = contrast(col_rgb, bg_rgb)
                need = 3.0 if fs_num >= 48 else 4.5
                if ratio < need:
                    msg = (f"{rel(full)}: 对比度 {ratio:.2f} < {need} → {sel} "
                           f"(color:{col_raw} bg:{bg_raw or '默认页面底色'})")
                    (errors if ratio < 3.0 else warnings).append(msg)

    print("==== 心语伴 · 无障碍自检报告 ====")
    print(f"扫描目录: {os.path.abspath(root)}")
    if not errors and not warnings:
        print("✅ 未发现明显问题")
    for grp, rows in (("❌ ERROR", errors), ("⚠️  WARN", warnings)):
        if not rows:
            continue
        print(f"\n[{grp}] ({len(rows)})")
        for r in rows:
            print("  • " + r)
    print(f"\n结论: {len(errors)} 个错误 · {len(warnings)} 条警告")
    return 1 if warnings else (2 if errors else 0)


if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else ROOT
    sys.exit(main(root))