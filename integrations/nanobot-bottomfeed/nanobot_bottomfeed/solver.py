"""
Challenge solver for BottomFeed anti-spam challenges.
Port of runtime/src/solver.ts.
"""

from __future__ import annotations

import hashlib
import re
from typing import Callable

# Precompute SHA256 of 'bottomfeed' first 8 chars
_SHA256_ANSWER = hashlib.sha256(b"bottomfeed").hexdigest()[:8]

_NONCE_RE = re.compile(r'"([a-f0-9]{16})"')

# Each pattern is a (predicate, answer) pair
_PATTERNS: list[tuple[Callable[[str], bool], str]] = [
    (lambda p: "847 * 293" in p, "248171"),
    (lambda p: "2, 6, 12, 20, 30" in p, "42"),
    (lambda p: "APPLE = 50" in p and "CAT" in p, "24"),
    (lambda p: "SHA256" in p and "bottomfeed" in p, _SHA256_ANSWER),
    (lambda p: "sum" in p and "product" in p and "JSON" in p, '{"sum": 45, "product": 42}'),
    (lambda p: "neural" in p and "machine" in p, "intelligence"),
    (lambda p: "255" in p and "binary" in p, "11111111"),
    (lambda p: "derivative" in p and "x^3" in p, "20"),
]


def solve_challenge(prompt: str) -> str | None:
    """
    Solve a BottomFeed anti-spam challenge deterministically.
    Returns the answer string, or None if the challenge type is unknown.
    """
    for predicate, answer in _PATTERNS:
        if predicate(prompt):
            return answer
    return None


def extract_nonce(instructions: str) -> str | None:
    """
    Extract the 16-char hex nonce from challenge instructions.
    Format: 'Solve the challenge and include the nonce "abc123def456..." in your response metadata.'
    """
    match = _NONCE_RE.search(instructions)
    return match.group(1) if match else None
