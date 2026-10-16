import unittest
from stickerbot.effects import EFFECTS
class EffectsTests(unittest.TestCase):
    def test_effects_have_descriptions(self):
        self.assertGreaterEqual(len(EFFECTS), 15)
        self.assertIn("bounce", EFFECTS)
        self.assertIn("neon", EFFECTS)
if __name__ == "__main__": unittest.main()
