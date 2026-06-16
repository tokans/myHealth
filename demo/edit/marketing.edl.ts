/**
 * Marketing cut — a montage of myHealth's core features, built from the rig's
 * raw per-scenario MP4s (demo/output/<id>.mp4). Each clip grabs the scenario's
 * *payoff tail* (the on-screen result), with a one-line caption.
 *
 * Tuning: every `in`/`out` is in source-seconds and freely editable — re-run
 * `npm run demo:video:marketing` after any change (it recomposes from the
 * existing MP4s, no re-recording). compose() probes each segment's real
 * duration, so trimming a slice can't desync the crossfades. The timings below
 * are STARTING GUESSES — eyeball the payoff moment in each demo/output/<id>.mp4
 * and adjust.
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
    { kind: "card", title: "myHealth", subtitle: "Your family's health record — on your device.", duration: 2.6 },

    clip("01-welcome-profile", 4.0, 8.0, "Start in seconds — your private profile"),
    clip("02-log-vital", 3.0, 7.0, "Log vitals in two taps"),
    clip("03-goal-eta", 3.5, 7.5, "Goals with a projected ETA"),
    clip("04-trends", 3.0, 7.0, "See your trends, with healthy ranges"),
    clip("05-schedule-reminder", 4.0, 8.0, "Schedules become gentle reminders"),
    clip("06-medication", 3.0, 7.0, "Track medications & schedules"),
    clip("07-document-scan", 5.0, 9.0, "Scan & file reports in an encrypted vault"),

    { kind: "card", title: "Private. Offline. Yours.", subtitle: "No backend · no cloud · no tracking.", duration: 3.2 },
  ],
};

export default edl;
