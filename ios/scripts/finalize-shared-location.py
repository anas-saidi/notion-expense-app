#!/usr/bin/env python3
"""Finish account-owned permissions and legacy path repair after the shared move."""
import json
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
assert root == Path('/Users/Shared/finance-app/notion-expense-app')
old = Path('/Users/anassaidi/Projects/ios-dev/finance-app/notion-expense-app')
uid = os.getuid()
marker = root / '.codex' / ('shared-access-' + str(uid) + '.json')

if not marker.exists():
    owned_dirs = [str(root)] if root.stat().st_uid == uid else []
    owned_files = []
    for base, directories, files in os.walk(root, followlinks=False):
        for name in directories + files:
            item = Path(base) / name
            if item.is_symlink() or item.lstat().st_uid != uid:
                continue
            (owned_dirs if item.is_dir() else owned_files).append(str(item))
    for user in ['atlas-dev', 'anassaidi']:
        ace = 'user:' + user + ' allow read,write,execute,delete,append,readattr,writeattr,readextattr,writeextattr,readsecurity'
        for paths, suffix in [(owned_dirs, ',file_inherit,directory_inherit'), (owned_files, '')]:
            for index in range(0, len(paths), 150):
                subprocess.run(['chmod', '+a', ace + suffix, *paths[index:index + 150]], check=True)
    marker.write_text(json.dumps({'uid': uid, 'sharedRoot': str(root)}) + '\n')

if not old.exists() and not old.is_symlink():
    try:
        old.symlink_to(root, target_is_directory=True)
        print('Created the legacy path link.')
    except PermissionError:
        print('Legacy path link needs the anassaidi account; shared checkout is usable now.')

subprocess.run(['git', '-C', str(root), 'worktree', 'repair'], check=True)
print('Shared checkout permission and Git path repairs are complete for this account.')
