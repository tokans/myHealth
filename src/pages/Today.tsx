import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Droplets, Plus, Minus, Check, Circle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JourneyStrip } from "@/components/feature/JourneyStrip";
import { isTauri } from "@/lib/environment";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { addGlasses, getWaterDay } from "@/db/water";
import { listTasksForToday, setTaskDone, createTask, type TaskToday } from "@/db/tasks";
import { defaultWaterGlasses, hydrationPct } from "@/domain/water";
import { cn } from "@/lib/utils";

export default function Today() {
  const { profile, loading } = useActiveProfile();
  const [glasses, setGlasses] = useState(0);
  const [target, setTarget] = useState(8);
  const [tasks, setTasks] = useState<TaskToday[]>([]);
  const [newTask, setNewTask] = useState("");

  async function reload(profileId: number) {
    const water = await getWaterDay(profileId);
    setGlasses(water?.glasses ?? 0);
    setTarget(water?.target_glasses ?? defaultWaterGlasses());
    setTasks(await listTasksForToday(profileId));
  }

  useEffect(() => {
    if (profile && isTauri()) void reload(profile.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  if (!profile) {
    return (
      <div className="space-y-6" data-testid="today-root">
        <Greeting name={null} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Welcome to myHealth
            </CardTitle>
            <CardDescription>
              Start by creating your profile. It takes a few seconds and everything stays on this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild data-testid="today-create-profile">
              <Link to="/profiles">Create my profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pid = profile.id;
  async function bumpWater(delta: number) {
    const next = await addGlasses(pid, delta, target);
    setGlasses(next);
  }
  async function toggleTask(t: TaskToday) {
    await setTaskDone(t.id, !t.done);
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
  }
  async function addNewTask() {
    const title = newTask.trim();
    if (!title) return;
    await createTask({ profile_id: pid, title });
    setNewTask("");
    setTasks(await listTasksForToday(pid));
  }

  const pct = hydrationPct(glasses, target);
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-6" data-testid="today-root">
      <Greeting name={profile.name} />
      <JourneyStrip />

      {/* Water intake */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-sky-500" /> Water
          </CardTitle>
          <CardDescription>
            {glasses} of {target} glasses today
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => bumpWater(-1)} disabled={glasses <= 0}>
              <Minus className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => bumpWater(1)} data-testid="today-add-water">
              <Plus className="h-4 w-4" /> Add a glass
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daily tasks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Today's tasks</CardTitle>
          <CardDescription>
            {tasks.length === 0
              ? "Add a small daily habit to get started."
              : `${doneCount} of ${tasks.length} done`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => toggleTask(t)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50",
                t.done && "text-muted-foreground",
              )}
            >
              {t.done ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 opacity-50" />
              )}
              <span className={cn(t.done && "line-through")}>{t.title}</span>
            </button>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Input
              placeholder="e.g. Walk 20 minutes"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNewTask()}
              data-testid="today-task-input"
            />
            <Button size="sm" variant="secondary" onClick={addNewTask} data-testid="today-add-task">
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Want to track a reading?{" "}
        <Link to="/metrics" className="text-primary underline-offset-4 hover:underline">
          Log a vital
        </Link>
      </p>
    </div>
  );
}

function Greeting({ name }: { name: string | null }) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {part}
        {name ? `, ${name.split(" ")[0]}` : ""}.
      </h1>
      <p className="text-muted-foreground">Here's your day at a glance.</p>
    </div>
  );
}
