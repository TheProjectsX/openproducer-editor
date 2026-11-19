# Core media fixtures

`sync-markers-24fps.srt` and `standalone.vtt` are locally authored subtitle fixtures for Video Studio caption import. They contain no third-party text.

These fixtures were generated locally on 2026-11-14 and 2026-11-15. They contain no user media, third-party recordings, or external assets. The generated test patterns and audio signals are dedicated to the public domain (CC0-1.0).

| File | Expected streams | Expected duration |
|---|---|---:|
| `av-red-blue.mp4` | H.264, 320×180, 24 fps; mono AAC, 48 kHz | 4.000 s |
| `av-green-yellow.webm` | VP9, 320×180, 24 fps; mono Opus, 48 kHz | 4.008 s |
| `tone-440.wav` | Mono PCM S16LE, 48 kHz, 440 Hz sine | 4.000 s |
| `tone-880-44100.wav` | Mono PCM S16LE, 44.1 kHz, 880 Hz sine | 4.000 s |
| `noisy-440-background.wav` | Mono PCM S16LE, 48 kHz; deterministic broadband noise throughout and a 440 Hz tone from 0.5 s onward | 4.000 s |
| `sync-markers-24fps.mp4` | H.264, 320×180, 24 fps; mono AAC, 48 kHz; colored frame marker each second and 1 kHz audio pulse at 1, 2, and 3 s | 4.000 s |
| `image-checker-alpha-400x340.png` | 400×340 RGBA raster checkerboard, 80 px transparent strip, opaque and translucent color patches | — |
| `image-checker-alpha-400x340.svg` | 400×340 checkerboard with an 80 px transparent strip, color patches, and translucent shapes | — |
| `image-collage-subject-green.svg` | 240×180 green landscape subject | — |
| `image-collage-subject-violet.svg` | 240×180 violet star subject | — |

Container and stream metadata was measured with FFprobe 7.1.4. The sync fixture's audio was checked with `silencedetect=noise=-35dB:d=0.1`; the three 20 ms tone pulses begin at 1.000, 2.000, and 3.000 seconds. The colored video marker advances at each second. In the 2026-11-14 Codex in-app browser run, the SVG was rejected because this browser could not decode it as an image; the PNG raster was accepted and rendered. The PNG was generated locally with Pillow from the same CC0 pattern description. The sync markers make timing offsets measurable but do not replace speech intelligibility review or tests across named browsers.
