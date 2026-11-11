#!/usr/bin/env python3
"""
Python E2E Test Runner Wrapper
3D Car and Plane Scene Generator

Delegates to `node tests/e2e_runner.mjs` and formats test results.
Supports all flags: --tier=1,2,3,4, --strict-56, --json.
"""

import sys
import subprocess
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent.parent
    runner = root / "tests" / "e2e_runner.mjs"
    
    if not runner.exists():
        print(f"Error: Test runner not found at {runner}", file=sys.stderr)
        sys.exit(1)

    cmd = ["node", str(runner)] + sys.argv[1:]
    res = subprocess.run(cmd, cwd=root)
    sys.exit(res.returncode)

if __name__ == "__main__":
    main()
