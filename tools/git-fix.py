#!/usr/bin/env python3
"""修复被 iCloud 清空的 .git 核心文件（HEAD / packed-refs）。
用法：python3 tools/git-fix.py   （在仓库根目录执行）
"""
import os

def main():
    head = '.git/HEAD'
    try:
        d = open(head, 'rb').read()
    except Exception:
        d = b''
    if len(d) < 5:
        with open(head, 'wb') as f:
            f.write(b'ref: refs/heads/main\n')
        print('[git-fix] repaired .git/HEAD')
    pr = '.git/packed-refs'
    try:
        d = open(pr, 'rb').read()
        if len(d) == 0:
            os.remove(pr)
            print('[git-fix] removed empty .git/packed-refs')
    except FileNotFoundError:
        pass
    cfg = '.git/config'
    try:
        d = open(cfg, 'rb').read()
        if len(d) < 10:
            with open(cfg, 'wb') as f:
                f.write(b'[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true')
            print('[git-fix] repaired .git/config')
    except Exception:
        pass

if __name__ == '__main__':
    main()
