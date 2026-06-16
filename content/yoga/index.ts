/**
 * Yoga — a baked content type with SUBTYPES (Morning / Relax / Balance). The
 * subtypes are an inline node tree (`buildNodeTree`); the content page navigates
 * them with a breadcrumb + next-node dropdown, and shows a leaf's sequences.
 * Inline SVG pose pics keep it fully offline; richer sequences arrive as signed
 * downloadable bundles. Movement guidance only, not medical advice.
 */
import { Flower2 } from "lucide-react";
import { buildNodeTree, type ContentType, type ContentEntry } from "@/content/model";
import { poseDataUri } from "./art";

const morningWakeUp: ContentEntry = {
  id: "yoga-morning-wake-up",
  name: "Morning Wake-Up Flow",
  level: "beginner",
  focus: "Morning energy",
  summary: "A gentle five-pose flow to loosen up and breathe before your day starts.",
  source: "baked",
  steps: [
    { title: "Mountain Pose", instruction: "Stand tall, feet hip-width, arms by your sides. Take five slow breaths.", durationSec: 30, image: poseDataUri("mountain") },
    { title: "Standing Forward Fold", instruction: "Hinge at the hips and let your upper body hang. Soft knees, relaxed neck.", durationSec: 30, image: poseDataUri("forward-fold") },
    { title: "Cat–Cow", instruction: "On hands and knees, alternate arching and rounding your spine with the breath.", durationSec: 40, image: poseDataUri("cow") },
    { title: "Downward Dog", instruction: "Lift the hips into an inverted V. Pedal the heels; lengthen the spine.", durationSec: 30, image: poseDataUri("downward-dog") },
    { title: "Child's Pose", instruction: "Sit back onto your heels, arms forward, forehead down. Rest and breathe.", durationSec: 45, image: poseDataUri("child") },
  ],
};

const deskRelief: ContentEntry = {
  id: "yoga-desk-relief",
  name: "Desk Relief Stretch",
  level: "beginner",
  focus: "Stress relief",
  summary: "Unwind tight shoulders and back after sitting — done in a few minutes.",
  source: "baked",
  steps: [
    { title: "Seated Twist", instruction: "Sit upright, place one hand behind you, and gently rotate your torso. Switch sides.", durationSec: 30, image: poseDataUri("seated-twist") },
    { title: "Cat–Cow", instruction: "Move to hands and knees and flow between arch and round to free the spine.", durationSec: 40, image: poseDataUri("cat") },
    { title: "Child's Pose", instruction: "Fold forward over your knees and let your shoulders drop. Breathe slowly.", durationSec: 45, image: poseDataUri("child") },
    { title: "Corpse Pose", instruction: "Lie flat, arms relaxed, eyes closed. Let the whole body soften.", durationSec: 60, image: poseDataUri("corpse") },
  ],
};

const balanceBasics: ContentEntry = {
  id: "yoga-balance-basics",
  name: "Balance Basics",
  level: "intermediate",
  focus: "Balance & focus",
  summary: "Build steadiness and concentration with standing balance and a gentle backbend.",
  source: "baked",
  steps: [
    { title: "Mountain Pose", instruction: "Ground both feet, lengthen the spine, and find a steady gaze ahead.", durationSec: 30, image: poseDataUri("mountain") },
    { title: "Tree Pose", instruction: "Shift weight to one foot, place the other sole on the calf or thigh, hands at heart. Switch sides.", durationSec: 40, image: poseDataUri("tree") },
    { title: "Warrior I", instruction: "Step one foot back, bend the front knee, and reach both arms overhead. Switch sides.", durationSec: 40, image: poseDataUri("warrior") },
    { title: "Bridge Pose", instruction: "Lie on your back, knees bent, and lift the hips while pressing through the feet.", durationSec: 30, image: poseDataUri("bridge") },
    { title: "Corpse Pose", instruction: "Release everything and rest flat for a few breaths to finish.", durationSec: 60, image: poseDataUri("corpse") },
  ],
};

const yoga: ContentType = {
  key: "yoga",
  label: "Yoga",
  icon: Flower2,
  tier: "tracker",
  releaseTag: "content-yoga-latest",
  description: "Guided yoga sequences with step-by-step poses.",
  entryNoun: "sequence",
  order: 10,
  samples: [],
  // Subtypes: pick a focus, then a sequence.
  tree: buildNodeTree({
    key: "yoga",
    label: "Yoga",
    children: [
      { key: "morning", label: "Morning", order: 1, entries: [morningWakeUp] },
      { key: "relax", label: "Relax", order: 2, entries: [deskRelief] },
      { key: "balance", label: "Balance", order: 3, entries: [balanceBasics] },
    ],
  }),
  source: "baked",
};

export default yoga;
