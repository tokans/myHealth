import { useEffect, useState } from "react";
import { Bell, Check, Clock, X, Plus } from "lucide-react";
import { bucketFor, dueLabel, byDueDate, addDaysISO, type ReminderBucket } from "sharedcorelib/reminders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isTauri } from "@/lib/environment";
import { localToday } from "@/lib/utils";
import {
  listOpenReminders,
  completeReminder,
  dismissReminder,
  snoozeReminder,
  createManualReminder,
  type Reminder,
} from "@/db/reminders";
import { syncHabitReminders } from "@/lib/reminderSweep";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { cn } from "@/lib/utils";

const BUCKET_ORDER: ReminderBucket[] = ["overdue", "due_soon", "upcoming", "snoozed"];
const BUCKET_LABEL: Record<ReminderBucket, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  upcoming: "Upcoming",
  snoozed: "Snoozed",
};
const BUCKET_STYLE: Record<ReminderBucket, string> = {
  overdue: "text-destructive",
  due_soon: "text-amber-600 dark:text-amber-400",
  upcoming: "text-muted-foreground",
  snoozed: "text-sky-600 dark:text-sky-400",
};

export default function Reminders() {
  const { profile } = useActiveProfile();
  const [items, setItems] = useState<Reminder[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(localToday());
  const today = localToday();

  async function load() {
    if (!isTauri()) return;
    await syncHabitReminders();
    setItems((await listOpenReminders()).sort(byDueDate));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(fn: () => Promise<void>) {
    await fn();
    await load();
  }
  async function addManual() {
    if (!title.trim()) return;
    await createManualReminder({ profile_id: profile?.id ?? null, title: title.trim(), due_date: due });
    setTitle("");
    await load();
  }

  const grouped = BUCKET_ORDER.map((b) => ({
    bucket: b,
    rows: items.filter((r) => bucketFor(r, today) === b),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Bell className="h-6 w-6 text-primary" /> Reminders
        </h1>
        <p className="text-muted-foreground">
          Water and daily-task nudges appear here automatically. Add your own below.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
          <Input placeholder="Remind me to…" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()} />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-44" />
          <Button onClick={addManual} disabled={!title.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardContent>
      </Card>

      {!isTauri() && <p className="text-sm text-muted-foreground">Reminders are available in the desktop app.</p>}

      {grouped.length === 0 && isTauri() && (
        <p className="text-sm text-muted-foreground">Nothing due. You're all caught up. 🎉</p>
      )}

      {grouped.map(({ bucket, rows }) => (
        <Card key={bucket}>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-sm", BUCKET_STYLE[bucket])}>{BUCKET_LABEL[bucket]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.detail ? `${r.detail} · ` : ""}
                    {bucket === "snoozed" && r.snoozed_until
                      ? `snoozed until ${r.snoozed_until}`
                      : dueLabel(r.due_date, today)}
                  </div>
                </div>
                <Button size="icon" variant="ghost" title="Done" onClick={() => act(() => completeReminder(r.id))}>
                  <Check className="h-4 w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" title="Snooze 1 day"
                  onClick={() => act(() => snoozeReminder(r.id, addDaysISO(today, 1)))}>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button size="icon" variant="ghost" title="Dismiss" onClick={() => act(() => dismissReminder(r.id))}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
