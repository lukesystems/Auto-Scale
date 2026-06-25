# ffmpeg setup for AutoScale Video Factory

AutoScale requires **ffmpeg** on the server PATH to render final MP4s.

## Check availability

```bash
ffmpeg -version
npm run verify:growth-run -- --project-id=<uuid> --growth-run-id=<uuid>
```

The verification harness reports `ffmpeg=true/false` in the environment section.

## Install

### macOS

```bash
brew install ffmpeg
```

### Windows

1. Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Add the `bin` folder to your system PATH
3. Or set `FFMPEG_PATH` to the full path of `ffmpeg.exe`

### Linux

```bash
sudo apt update && sudo apt install -y ffmpeg
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FFMPEG_PATH` | Override path to ffmpeg binary |
| `VOICE_PROVIDER` | `elevenlabs` (default), `openai`, or `silent` |
| `ELEVENLABS_API_KEY` | Primary TTS for postable voiceover |
| `OPENAI_API_KEY` | Fallback TTS |
| `FAL_KEY` | Optional AI b-roll via Seedance |

## Without ffmpeg

- Videos stay in `awaiting_ffmpeg` / `rendering` status
- Production jobs pause at `awaiting_ffmpeg`
- Quality gate cannot pass (no final MP4)
- Autopilot Managed mode will **not** auto-start runs

## Runtime error

If ffmpeg is missing, render throws:

> ffmpeg is not installed or not available on PATH.

Fix by installing ffmpeg and restarting the dev server.
