/**
 * Exercises — a second baked content type, demonstrating that dropping a folder
 * under `content/` adds a tab with no other wiring. Ships a couple of simple
 * bodyweight routines; richer ones download as signed bundles from the release
 * tag below. General movement guidance only, not medical or training advice.
 */
import { Dumbbell } from "lucide-react";
import type { ContentType, ContentEntry } from "@/content/model";

const SAMPLES: ContentEntry[] = [
  {
    id: "ex-wake-up-mobility",
    name: "Wake-Up Mobility",
    level: "beginner",
    focus: "Mobility",
    summary: "A short joint-mobility routine to start the day moving freely.",
    source: "baked",
    steps: [
      { title: "Neck Rolls", instruction: "Slowly circle the head a few times each way. Keep it gentle.", durationSec: 30 },
      { title: "Shoulder Circles", instruction: "Roll the shoulders forward, then back, big and slow.", durationSec: 30 },
      { title: "Hip Circles", instruction: "Hands on hips, draw slow circles with the hips each direction.", durationSec: 40 },
      { title: "Ankle Rolls", instruction: "Lift one foot and circle the ankle; switch sides.", durationSec: 30 },
    ],
  },
  {
    id: "ex-bodyweight-basics",
    name: "Bodyweight Basics",
    level: "beginner",
    focus: "Strength",
    summary: "A simple full-body circuit with no equipment. Rest as you need.",
    source: "baked",
    steps: [
      { title: "Squats", instruction: "Feet shoulder-width, sit back and down, then stand. Aim for 10 slow reps.", durationSec: 45 },
      { title: "Wall Push-Ups", instruction: "Hands on a wall, lower the chest in and press back out. 10 reps.", durationSec: 45 },
      { title: "Glute Bridge", instruction: "On your back, knees bent, lift the hips and squeeze. 10 reps.", durationSec: 45 },
      { title: "March in Place", instruction: "Lift the knees and march steadily to cool down.", durationSec: 60 },
    ],
  },
];

const exercises: ContentType = {
  key: "exercises",
  label: "Exercises",
  icon: Dumbbell,
  tier: "tracker",
  releaseTag: "content-exercises-latest",
  description: "Simple guided exercise routines, step by step.",
  entryNoun: "routine",
  order: 20,
  samples: SAMPLES,
  source: "baked",
};

export default exercises;
