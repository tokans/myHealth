# myHealth

**Your family's health record, kept by you, on your device — never in
anyone's cloud.** myHealth is a private, offline-first family health
companion. There is no account, no server, and no tracking.

🌐 **Website:** [https://tokans.github.io/myHealth/](https://tokans.github.io/myHealth/)

## What it does

- 👪 **Profiles for the whole family** — track vitals, goals and
  medications per person, all scoped to who you're looking at.
- 📈 **Vitals & trends** — log weight, BP, glucose and more; see trends
  charted against healthy reference ranges.
- 🎯 **Goals with a projected ETA** — set a target and get a realistic,
  deterministic estimate from your own readings.
- ⏰ **Reminders** — water, daily tasks, medications and schedule blocks
  become gentle on-device reminders.
- 🧾 **Medical documents** — store prescriptions, lab reports and
  insurance cards in an encrypted vault; scan & extract the key fields.
- 🆘 **Emergency ICE card** — a grab-and-go medical card for emergencies.
- 🔐 **Encrypted vault** — documents are protected by a master password
  (Argon2id + Stronghold) and AES-256-GCM. Nothing is stored in the clear.

## Download

Browse screenshots, the demo, and what's new on the
[project website](https://tokans.github.io/myHealth/), or grab the installer for your platform
from the [latest release](https://github.com/tokans/myHealth/releases/latest):

| Platform | File |
| --- | --- |
| Windows | `.msi` / `.exe` installer |
| macOS (Intel + Apple Silicon) | universal `.dmg` |
| Android (arm64, experimental) | `.apk` (sideload) · `.aab` |
| iOS (experimental) | unsigned build |

All assets for this version are attached to the
[v0.1.2 release](https://github.com/tokans/myHealth/releases/tag/v0.1.2).

> Mobile builds are **experimental and unsigned** for now: the Android
> `.apk` is debug-signed (sideloadable, not production) and iOS is not
> yet code-signed.

## Privacy

myHealth has **no backend and no telemetry**. All data lives in a local
SQLite database and an encrypted vault on your own machine. The only
network use is receive-only: pulling signed public reference content.

---

## Release notes — v0.1.2

**Full Changelog**: https://github.com/tokans/myHealth/compare/v0.1.1...v0.1.2

---

_This README is generated automatically on each release._
