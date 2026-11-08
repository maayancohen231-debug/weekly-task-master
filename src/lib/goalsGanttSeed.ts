// Goals board ("לוח מטרות") seeded from her Excel file "Goals board (1).xlsx"
// (R-089, 2026-11-08), restyled after her design sample "לוח מטרות תשפ_ז.html":
// one row per goal (title + small detail), thin bars, year-round habits as cards.
// Month index 0 = September … 11 = August of the school year.

export interface GanttArea { id: string; name: string; note?: string; color: string; }
export interface GanttBar { id: string; areaId: string; label: string; detail?: string; start: number; end: number; }
export interface GanttHabitGroup { id: string; title: string; items: string[]; }
export interface GanttYear {
  id: string;
  title: string;          // e.g. תשפ"ז
  startYear: number;      // Gregorian year of its September
  hebMonths: string[];    // 12 labels, Sep → Aug
  areas: GanttArea[];
  bars: GanttBar[];
  habits: GanttHabitGroup[];
}
export interface GanttData { version: 2; years: GanttYear[]; }

/** Area colours from her design sample. */
export const AREA_COLORS = {
  acad: '#d9776a',
  entr: '#5aa77f',
  work: '#8b7bd1',
  duv: '#d6a440',
  pub: '#5b93c7',
  army: '#8a9099',
};

const HEB_5786 = ['אלול–תשרי', 'תשרי–חשוון', 'חשוון–כסלו', 'כסלו–טבת', 'טבת–שבט', 'שבט–אדר', 'אדר–ניסן', 'ניסן–אייר', 'אייר–סיון', 'סיון–תמוז', 'תמוז–אב', 'אב–אלול'];
const HEB_5787 = ['אלול–תשרי', 'תשרי–חשוון', 'חשוון–כסלו', 'כסלו–טבת', 'טבת–שבט', "שבט–אדר א'", "אדר א'–אדר ב'", "אדר ב'–ניסן", 'ניסן–אייר', 'אייר–סיון', 'סיון–תמוז', 'תמוז–אב'];

let n = 0;
const b = (areaId: string, start: number, end: number, label: string, detail?: string): GanttBar =>
  ({ id: `seed${++n}`, areaId, label, ...(detail ? { detail } : {}), start, end });

export const GANTT_SEED: GanttData = {
  version: 2,
  years: [
    {
      id: 'y5786',
      title: 'תשפ"ו',
      startYear: 2025,
      hebMonths: HEB_5786,
      areas: [
        { id: 'acad', name: 'אקדמיה ולימודים', color: AREA_COLORS.acad },
        { id: 'entr', name: 'יזמות והתפתחות', color: AREA_COLORS.entr },
        { id: 'duv', name: 'דובדבן', color: AREA_COLORS.duv },
        { id: 'army', name: 'שירות צבאי ומילואים', color: AREA_COLORS.army },
      ],
      bars: [
        b('acad', 1, 5, 'סמסטר א\'', "מבני נתונים · הסקה סטטיסטית · תורת המחירים א'"),
        b('acad', 5, 5, 'מבחנים'),
        b('acad', 7, 10, 'סמסטר ב\'', "תורת המחירים ב' · מבוא לאלגוריתמים ומבני נתונים"),
        b('acad', 9, 9, 'הרשמה לאת"א'),
        b('acad', 10, 11, 'מבחנים'),
        b('acad', 11, 11, 'מיקוד באנגלית לקראת אמירנט'),
        b('acad', 0, 11, 'אנגלית', '3 שעות תרגול ביום + 2 שיעורים'),
        b('entr', 1, 5, 'תוכנית BoostCamp DAROM'),
        b('entr', 1, 5, 'תוכנית יזמות באוניברסיטת רייכמן'),
        b('entr', 2, 4, 'IAI Innosphere'),
        b('entr', 7, 9, 'טיול במזרח + מונטנגרו'),
        b('entr', 10, 11, 'תוכנית "מלימודים לקריירה"'),
        b('duv', 1, 4, 'מלגאית'),
        b('duv', 5, 6, 'מעבר ל"מלגאית זהב"'),
        b('duv', 7, 10, 'מלגאית זהב'),
        b('duv', 11, 11, 'כניסה לתפקיד של זיויק'),
        b('army', 1, 5, 'מילואים'),
        b('army', 6, 8, 'מילואים', 'עם כלביא'),
      ],
      habits: [
        { id: 'morning', title: 'כל בוקר', items: ['תודה על מה שיש לי'] },
        { id: 'daily', title: 'כל יום', items: ['תזונה בריאה', 'תרגול נשימות', 'אנגלית'] },
        { id: 'weekly', title: 'כל שבוע', items: ['לפחות 3 אימונים', 'פסיכולוגית'] },
      ],
    },
    {
      id: 'y5787',
      title: 'תשפ"ז',
      startYear: 2026,
      hebMonths: HEB_5787,
      areas: [
        { id: 'acad', name: 'אקדמיה', color: AREA_COLORS.acad },
        { id: 'entr', name: 'יזמות והתפתחות', color: AREA_COLORS.entr },
        { id: 'work', name: 'עבודה', color: AREA_COLORS.work },
        { id: 'duv', name: 'דובדבן', note: 'בהתנדבות', color: AREA_COLORS.duv },
        { id: 'pub', name: 'פעילות ציבורית', color: AREA_COLORS.pub },
      ],
      bars: [
        b('acad', 0, 0, 'מיקוד באנגלית לקראת מועד'),
        b('acad', 0, 6, "אנגלית – יעד מתקדמים ב'", '3 שעות תרגול ביום + 2 שיעורים'),
        b('acad', 4, 4, 'מבחן אמיר"ם', "מתקדמים ב'"),
        b('acad', 1, 3, 'עקרונות פיתוח מערכות מידע', '+ מושגי יסוד באקונומטריקה'),
        b('acad', 1, 4, 'קורסי פסיכולוגיה', 'סטטיסטיקה ב · מבוא לפסיכולוגיה · אישיות · השתתפות במחקרים'),
        b('entr', 0, 1, 'טיול לנפאל'),
        b('entr', 0, 1, 'תוכנית "מלימודים לקריירה"'),
        b('entr', 2, 4, 'MindWell', 'מוצר ופיילוט'),
        b('entr', 2, 4, 'לוחמים לקריירה', 'השמה ראשונה וקשר עם חברות מובילות'),
        b('work', 0, 6, 'פאודה', 'הכנסה צדדית קבועה'),
        b('work', 1, 4, 'PUNCT – ניסיון CTO', 'העברת הפיתוח · מחולל קליטה · סליקה'),
        b('duv', 0, 1, 'תפקיד זמני'),
        b('duv', 0, 4, 'פרויקט עמית', '10 מנטורים בעזרה ראשונה נפשית'),
        b('duv', 2, 4, 'ליווי אופרטיבי והקלה על העו"סיות', 'סיום עד סוף ינואר'),
        b('pub', 1, 4, 'ישראל 2050 – הכשרה', 'רביעי 17:00–21:00 · קואליציה לבריאות הנפש'),
      ],
      habits: [
        { id: 'morning', title: 'כל בוקר', items: ['תודה', 'שיחה לסבתא', 'לסדר את החדר'] },
        { id: 'daily', title: 'כל יום', items: ['אימון (שלישי ושבת – לא חובה)', 'תזונה בריאה', 'תרגול נשימות', 'אנגלית'] },
        { id: 'weekly', title: 'כל שבוע', items: ['משימות ויעדים שבועיים', 'ערב חופשי', 'יום כיף עם אח/ות', 'חצי יום מנוחה', 'פסיכולוגית'] },
      ],
    },
  ],
};
