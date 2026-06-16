/**
 * Marketing cut — a ~60-second advert montage of myHealth's core features,
 * built from the rig's raw per-scenario MP4s (demo/output/<id>.mp4). Each clip
 * grabs the scenario's *payoff tail* (the on-screen result) under a one-line
 * lower-third caption, bookended by full-screen title cards — including an
 * Android beat that ties the video to the sideloadable APK on the landing page.
 *
 * Text overlays are burned in by compose(): `caption` → a faded lower-third
 * pill over a clip; a `card` segment → a full-screen title/subtitle.
 *
 * Tuning: every `in`/`out` is in source-seconds and freely editable — re-run
 * `npm run demo:video:marketing` after any change (it recomposes from the
 * existing MP4s, no re-recording). compose() probes each segment's real
 * duration, so trimming a slice can't desync the crossfades. The windows below
 * are tuned for a ~60s total but remain STARTING GUESSES — eyeball the payoff
 * moment in each demo/output/<id>.mp4 and adjust. (If a recording is shorter
 * than a clip's `out`, ffmpeg simply stops at its end — the cut stays in sync.)
 */
import { join } from "node:path";
import type { VideoEdl, ClipSegment } from "@mydemo/core";
import { DIRS, VIDEO } from "../config.ts";

const clip = (id: string, inS: number, outS: number, caption: string, rate = 1): ClipSegment => ({
  kind: "clip",
  source: join(DIRS.output, `${id}.mp4`),
  in: inS,
  out: outS,
  rate,
  caption,
});

const edl: VideoEdl = {
  id: "marketing",
  transition: 0.4,
  music: {
    // Drop a royalty-free track here (see DEMO.md › Music). Rendered silent if absent.
    file: join(VIDEO.musicDir, "marketing.mp3"),
    volume: 0.55,
    fadeIn: 1.5,
    fadeOut: 2.5,
  },
  segments: [
    { kind: "card", title: "myHealth", subtitle: "Your family's health record — on your device.", duration: 3.0 },

    clip("01-welcome-profile", 3.0, 10.0, "Start in seconds — your private profile"),
    clip("02-log-vital", 2.5, 9.0, "Log vitals in two taps"),
    clip("03-goal-eta", 3.0, 10.0, "Goals with a projected ETA"),
    clip("04-trends", 2.5, 9.0, "See your trends, with healthy ranges"),
    clip("05-schedule-reminder", 3.0, 10.0, "Schedules become gentle reminders"),
    clip("06-medication", 2.5, 9.0, "Track medications & schedules"),
    clip("07-document-scan", 4.0, 11.0, "Scan & file reports in an encrypted vault"),

    { kind: "card", title: "Now on Android, too", subtitle: "Sideload the APK from the latest release.", duration: 3.5 },
    { kind: "card", title: "Private. Offline. Yours.", subtitle: "No backend · no cloud · no tracking.", duration: 3.5 },
  ],
};

export default edl;
