import type { Task, TaskColor, TaskStatus } from './task-types';

const STORAGE_KEY = 'weekly-planner-data';

let _id = 1;
const sid = () => `seed_${_id++}`;

type T = { content: string; status?: TaskStatus; color?: TaskColor; isDaily?: boolean };

function makeTasks(dayId: string, items: T[]): Task[] {
  return items.map((item, i) => ({
    id: sid(),
    content: item.content,
    status: item.status ?? 'green',
    color: item.color ?? 'none',
    dayId,
    isDaily: item.isDaily ?? false,
    sortOrder: i,
  }));
}

const tasksByWeek: Record<string, Task[]> = {

  // ── Mar 22–26, 2026 ──────────────────────────────────────────────
  '2026-03-22': [
    ...makeTasks('sun', [
      { content: 'Upload to Salesforce tasks for practice', status: 'red' },
      { content: 'Tidy up the room' },
      { content: 'Update call with Anders' },
      { content: 'Update call with Shai' },
      { content: 'Call Grandma' },
      { content: 'Write a gratitude list' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
    ]),
    ...makeTasks('mon', [
      { content: 'Tidy up the room' },
      { content: 'Status call with Stav' },
      { content: 'Task assignment meeting with Stav' },
      { content: 'Update Registrants for Casualty Event' },
      { content: 'Consolidation of price quotes for the WhatsApp system of the Duvdevan Association' },
      { content: 'Send an email to Tel Aviv University about completing psychology studies' },
      { content: 'Call Grandma' },
      { content: 'Check international status at the university' },
      { content: 'Write a gratitude list' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
    ]),
    ...makeTasks('tue', [
      { content: 'Tidy up the room' },
      { content: 'Call Grandma' },
      { content: 'Write a gratitude list' },
      { content: 'Business English practice 2' },
      { content: 'Business English practice 1' },
      { content: 'Email to Tamar and regarding the automations of the communities' },
      { content: 'Mid-Year Scholarship Feedback Form' },
      { content: 'Quarterly Summary Document - Resilience Department' },
      { content: 'Phenoma - Building a Macro Syllabus for the Training Program' },
      { content: 'Complete submission for Impact Scholarship' },
    ]),
    ...makeTasks('wed', [
      { content: 'Tidy up the room' },
      { content: 'Call Grandma' },
      { content: 'Write a gratitude list' },
      { content: 'Business English practice 2' },
      { content: 'Business English practice 1' },
    ]),
    ...makeTasks('thu', [
      { content: 'Tidy up the room' },
      { content: 'Call Grandma' },
      { content: 'Write a gratitude list' },
      { content: 'Business English practice 2' },
      { content: 'Business English practice 1' },
    ]),
  ],

  // ── Mar 15–19, 2026 ──────────────────────────────────────────────
  '2026-03-15': [
    ...makeTasks('sun', [
      { content: 'Workout', color: 'purple' },
      { content: 'Tidy up the room' },
      { content: 'Apply to Sand Studies University' },
      { content: 'Hosen // Control system development' },
      { content: 'Write a gratitude list' },
      { content: 'Update call with Andres' },
    ]),
    ...makeTasks('mon', [
      { content: 'Write a gratitude list' },
      { content: 'Buy flight ticket to Thailand' },
      { content: "Check for Tal's work at IAI" },
      { content: "Work on Ayelet's sales website" },
      { content: "Work on Dad's book" },
      { content: 'University status update' },
      { content: 'Update call with Shai' },
      { content: 'Amirnet exam study plan' },
      { content: 'Sunset trip to Mitzpe Tzora with Itay' },
      { content: 'Renovating the home office with Ariel' },
      { content: 'English vocabulary practice' },
    ]),
    ...makeTasks('tue', [
      { content: 'Workout', color: 'purple' },
      { content: 'Approve with Leah 2 new employees Mindwell' },
      { content: 'Huggy doll - publication in the cherry association and coordination with Shai' },
      { content: 'Conversation with Ofer about the reserve' },
      { content: 'Practicing English reading' },
      { content: 'English vocabulary practice' },
      { content: 'Building a website for a work plan' },
      { content: "Building a website for purchasing Dad's book" },
    ]),
    ...makeTasks('wed', [
      { content: 'Write a gratitude list' },
      { content: 'To approve vis-a-vis Zimri a new date for an event for the injured' },
      { content: 'Workout', color: 'purple' },
      { content: 'Build a curriculum to complete your degree' },
    ]),
    ...makeTasks('thu', [
      { content: 'Write a gratitude list' },
      { content: 'Business English practice 1', status: 'red' },
      { content: 'Business English practice 2' },
      { content: 'Approval of budget management 2026 - Mindwell' },
    ]),
  ],

  // ── Feb 22–26, 2026 ──────────────────────────────────────────────
  '2026-02-22': [
    ...makeTasks('sun', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Registration form for wounded survivors event' },
      { content: 'Continue PTSD protocol development' },
      { content: 'Analysis of questionnaire results and insights' },
      { content: 'Final university registration' },
    ]),
    ...makeTasks('tue', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Email for Amirnet test' },
      { content: 'Task distribution Zoom before execution' },
      { content: 'Withdrawal of deposit funds' },
      { content: 'Call with the Open University' },
      { content: 'Goals and objectives for the next quarter' },
      { content: 'Update call with Shay' },
      { content: 'Update call with Andres' },
    ]),
    ...makeTasks('wed', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Update call with Lea' },
    ]),
  ],

  // ── Feb 15–19, 2026 ──────────────────────────────────────────────
  '2026-02-15': [
    ...makeTasks('sun', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Price Theory I - Exam 1' },
      { content: 'Price Theory I - Exam 2' },
      { content: 'Price Theory I - Exam 3' },
      { content: 'Register for the university' },
      { content: 'Check approval of the study program' },
      { content: 'Order a new desk' },
      { content: 'Obtain a letter from the psychiatrist' },
      { content: 'Write a personal letter requesting' },
      { content: 'Status update with Shay' },
      { content: 'Status update with Leah' },
    ]),
    ...makeTasks('mon', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Price Theory I - Exam 1' },
      { content: 'Price Theory I - Exam 2' },
      { content: 'Price Theory I - Exam 3' },
      { content: 'Accelerator research for Regulo' },
      { content: 'Exam Appeals Submission' },
      { content: 'Finish messaging for wounded veterans event' },
      { content: 'Graphics for Mom' },
      { content: 'Cherry Bot flowchart - Hosen' },
      { content: 'Cherry Bot flowchart - Duvdevan' },
      { content: 'Status update with Shay' },
    ]),
    ...makeTasks('tue', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Business English practice 3' },
      { content: 'Price Theory I - Exam 1' },
      { content: 'Price Theory I - Exam 2' },
      { content: 'Price Theory I - Exam 3' },
      { content: 'Summary for Price Theory 1 exam' },
      { content: 'Academic advising meeting' },
      { content: 'Update call with Smadar' },
      { content: 'Pick up package' },
    ]),
    ...makeTasks('wed', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Price Theory I - Exam 1' },
      { content: 'Price Theory I - Exam 2' },
      { content: 'Price Theory I - Exam 3' },
      { content: 'Update call with Smadar' },
      { content: 'Update call with Lea' },
      { content: 'Update call with Guy' },
      { content: 'Hosen // Project Dashboard' },
      { content: 'Startup Ideation' },
    ]),
    ...makeTasks('thu', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Call Dror - PTSD videos' },
      { content: 'Continue PTSD protocol development' },
      { content: "PTSD therapist's toolkit" },
    ]),
  ],

  // ── Feb 8–12, 2026 ───────────────────────────────────────────────
  '2026-02-08': [
    ...makeTasks('sun', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Schedule Amirnet test' },
      { content: 'Python Exam Practice 1' },
      { content: 'Python Exam Practice 2' },
      { content: 'Plan weekly schedule' },
      { content: 'Revamp the pitch deck' },
      { content: 'REGULO Work Management System' },
      { content: 'Update call with Shay' },
      { content: 'Summary for the Python exam' },
    ]),
    ...makeTasks('mon', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Create a logo for Hoshen' },
      { content: 'Create a website for Hoshen' },
      { content: 'Create a calendar for Hoshen' },
      { content: 'Logo for Dad' },
      { content: 'Designs for Mom' },
      { content: 'Register for the next semester' },
      { content: 'Building a study plan' },
      { content: 'Withdrawing the military deposit' },
      { content: 'Library assignment' },
    ]),
    ...makeTasks('tue', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Schedule an academic advising session' },
      { content: 'Order a desk for the work room' },
      { content: 'Pick up the deliveries' },
      { content: 'Register for courses for next semester' },
      { content: 'Send messages to the casualty incident' },
      { content: 'Fix the injured event questionnaire' },
      { content: 'Submit a new study plan' },
      { content: 'Website for the Resilience Department' },
    ]),
    ...makeTasks('wed', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Academic advising' },
      { content: 'Submit a study plan' },
      { content: 'Schedule for next week' },
    ]),
    ...makeTasks('thu', [
      { content: 'Tidy up the room' },
      { content: 'Write a gratitude list' },
      { content: 'Call Grandma' },
      { content: 'Business English practice 1' },
      { content: 'Business English practice 2' },
      { content: 'Continue building the protocol with Ginat' },
      { content: 'Divide the protocol into 6 topics' },
      { content: 'Prepare for the pitch' },
      { content: 'Revise the investor presentation' },
      { content: 'Intermediate Microeconomics I Exam 1' },
    ]),
  ],
};

const SEED_PAYLOAD = {
  tasksByWeek,
  goalsByWeek: {},
  libraryTasks: [],
};

/** Write seed data to localStorage unconditionally and reload the page. */
export function forceSeedData(): void {
  console.log('[Seed] Force-writing seed data...');
  console.log('[Seed] Weeks:', Object.keys(tasksByWeek));
  console.log('[Seed] Total tasks:', Object.values(tasksByWeek).flat().length);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PAYLOAD));
  console.log('[Seed] Written to localStorage key:', STORAGE_KEY);
  window.location.reload();
}

/** Write seed data only if localStorage is completely empty. */
export function initSeedData(): void {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      const weekCount = Object.keys(parsed?.tasksByWeek ?? {}).length;
      const taskCount = Object.values(parsed?.tasksByWeek ?? {}).flat().length;
      console.log(`[Seed] Found existing data — ${weekCount} weeks, ${taskCount} tasks. Skipping seed.`);
      return;
    } catch {
      console.log('[Seed] Existing data is invalid JSON, overwriting with seed.');
    }
  } else {
    console.log('[Seed] No existing data found, writing seed.');
  }
  console.log('[Seed] Writing seed data for weeks:', Object.keys(tasksByWeek));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PAYLOAD));
  console.log('[Seed] Done.');
}
