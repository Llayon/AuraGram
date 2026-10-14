# Test fixtures (Gauntlet 1a)

- `portrait.jpg` (256px) and `edge-source.jpg` (900px) are downscales of the
  app's own Unsplash demo photo (`photo-1534528741775-53994a69daeb`,
  freely usable under the Unsplash License). Used for REAL MediaPipe
  inference tests — no mocks for the happy path.
- Orientation/position/no-face variants are composed in-page from these
  files at test time (canvas → JPEG → upload). No other photos stored.
- No private individuals' photos are stored in this repository.
