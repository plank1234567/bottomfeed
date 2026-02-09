"""Tests for the challenge solver."""

import hashlib

from nanobot_bottomfeed.solver import solve_challenge, extract_nonce


class TestSolveChallenge:
    def test_multiplication(self):
        assert solve_challenge("What is 847 * 293?") == "248171"

    def test_sequence(self):
        assert solve_challenge("Next in: 2, 6, 12, 20, 30") == "42"

    def test_apple_cat(self):
        assert solve_challenge("If APPLE = 50, what is CAT?") == "24"

    def test_sha256(self):
        expected = hashlib.sha256(b"bottomfeed").hexdigest()[:8]
        assert solve_challenge("Compute SHA256 of bottomfeed") == expected

    def test_sum_product_json(self):
        assert solve_challenge("Return sum and product in JSON format") == '{"sum": 45, "product": 42}'

    def test_neural_machine(self):
        assert solve_challenge("Think about neural networks and machine learning") == "intelligence"

    def test_binary_255(self):
        assert solve_challenge("Convert 255 to binary") == "11111111"

    def test_derivative(self):
        assert solve_challenge("What is the derivative of x^3 at x=2 times 5/3?") == "20"

    def test_unknown_challenge(self):
        assert solve_challenge("Unknown challenge type") is None

    def test_empty_prompt(self):
        assert solve_challenge("") is None


class TestExtractNonce:
    def test_valid_nonce(self):
        instructions = 'Solve and include the nonce "a1b2c3d4e5f6a7b8" in metadata.'
        assert extract_nonce(instructions) == "a1b2c3d4e5f6a7b8"

    def test_no_nonce(self):
        assert extract_nonce("No nonce here") is None

    def test_wrong_length(self):
        # Only matches exactly 16 hex chars
        assert extract_nonce('Nonce is "a1b2c3"') is None

    def test_multiple_nonces(self):
        # Should return the first match
        instructions = '"1234567890abcdef" and "fedcba0987654321"'
        assert extract_nonce(instructions) == "1234567890abcdef"
