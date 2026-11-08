// Goals board ("לוח מטרות") seeded from her Excel file "Goals board (1).xlsx"
// (R-089, 2026-11-08). Month index 0 = September … 11 = August of the school year.

export type GanttColor = 'rose' | 'green' | 'amber' | 'gray' | 'yellow' | 'purple' | 'blue';

export interface GanttArea { id: string; name: string; emoji: string; color: GanttColor; }
export interface GanttBar { id: string; areaId: string; label: string; start: number; end: number; }
export interface GanttYear {
  id: string;
  title: string;          // e.g. תשפ"ז
  startYear: number;      // Gregorian year of its September
  hebMonths: string[];    // 12 labels, Sep → Aug
  areas: GanttArea[];
  bars: GanttBar[];
}
export interface GanttData { version: 1; years: GanttYear[]; }

export const GANTT_COLORS: Record<GanttColor, { lane: string; bar: string; accent: string; text: string }> = {
  rose:   { lane: '#F9DBD7', bar: '#FCECEB', accent: '#C0605A', text: '#6B2722' },
  green:  { lane: '#D1E7DD', bar: '#E8F5E9', accent: '#2E7D5B', text: '#174A33' },
  amber:  { lane: '#FCEBD0', bar: '#FDF8E7', accent: '#B7791F', text: '#5F3C08' },
  gray:   { lane: '#E1E2E4', bar: '#F1F4F4', accent: '#6B7280', text: '#2F343C' },
  yellow: { lane: '#FBF3CF', bar: '#FDFCE8', accent: '#A68A1B', text: '#4F420B' },
  purple: { lane: '#E1D9F3', bar: '#F3EBF6', accent: '#7C5CB8', text: '#3B2766' },
  blue:   { lane: '#D3E6F0', bar: '#EBF5FA', accent: '#3B7EA1', text: '#183E52' },
};

const HEB_5786 = ['אלול–תשרי', 'תשרי–חשוון', 'חשוון–כסלו', 'כסלו–טבת', 'טבת–שבט', 'שבט–אדר', 'אדר–ניסן', 'ניסן–אייר', 'אייר–סיון', 'סיון–תמוז', 'תמוז–אב', 'אב–אלול'];
const HEB_5787 = ['אלול–תשרי', 'תשרי–חשוון', 'חשוון–כסלו', 'כסלו–טבת', 'טבת–שבט', "שבט–אדר א'", "אדר א'–אדר ב'", "אדר ב'–ניסן", 'ניסן–אייר', 'אייר–סיון', 'סיון–תמוז', 'תמוז–אב'];

let n = 0;
const b = (areaId: string, start: number, end: number, label: string): GanttBar => ({ id: `seed${++n}`, areaId, label, start, end });

export const GANTT_SEED: GanttData = {
  version: 1,
  years: [
    {
      id: 'y5786',
      title: 'תשפ"ו',
      startYear: 2025,
      hebMonths: HEB_5786,
      areas: [
        { id: 'acad', name: 'אקדמיה ולימודים', emoji: '🎓', color: 'rose' },
        { id: 'entr', name: 'יזמות והתפתחות אישית', emoji: '🚀', color: 'green' },
        { id: 'duv', name: 'דובדבן', emoji: '🎗️', color: 'amber' },
        { id: 'army', name: 'שירות צבאי ומילואים', emoji: '🪖', color: 'gray' },
        { id: 'pers', name: 'יעדים - אישי', emoji: '🧘', color: 'yellow' },
        { id: 'study', name: 'יעדים - לימודי', emoji: '📚', color: 'rose' },
      ],
      bars: [
        b('acad', 1, 5, "מבני נתונים + הסקה סטטיסטית + תורת המחירים א'"),
        b('acad', 7, 10, "תורת המחירים ב' + מבוא לאלגוריתמים ומבני נתונים"),
        b('acad', 11, 11, 'מיקוד באנגלית לקראת אמירנט'),
        b('acad', 5, 5, 'מבחנים'),
        b('acad', 9, 9, 'הרשמה לאת"א'),
        b('acad', 10, 11, 'מבחנים'),
        b('entr', 2, 4, 'IAI Innosphere'),
        b('entr', 7, 9, 'טיול במזרח + מונטנגרו'),
        b('entr', 1, 5, 'תוכנית BoostCamp DAROM'),
        b('entr', 1, 5, 'תוכנית יזמות באוניברסיטת רייכמן'),
        b('entr', 10, 11, 'תוכנית "מלימודים לקריירה"'),
        b('duv', 1, 4, 'מלגאית'),
        b('duv', 5, 6, 'מעבר ל"מלגאית זהב"'),
        b('duv', 7, 10, 'מלגאית זהב'),
        b('duv', 11, 11, 'כניסה לתפקיד של זיויק'),
        b('army', 1, 5, 'מילואים'),
        b('army', 6, 8, 'מילואים - עם כלביא'),
        b('pers', 1, 11, 'להקפיד לכתוב תודה כל בוקר על מה שיש לי + להקפיד על פסיכולוגית פעם בשבוע'),
        b('pers', 1, 11, 'תזונה בריאה + לפחות 3 אימונים בשבוע + תרגול נשימות'),
        b('study', 0, 11, '3 שעות יומיות תרגול אנגלית'),
        b('study', 0, 11, '2 שיעורי אנגלית יומיים'),
      ],
    },
    {
      id: 'y5787',
      title: 'תשפ"ז',
      startYear: 2026,
      hebMonths: HEB_5787,
      areas: [
        { id: 'acad', name: 'אקדמיה ולימודים', emoji: '🎓', color: 'rose' },
        { id: 'entr', name: 'יזמות והתפתחות אישית', emoji: '🚀', color: 'green' },
        { id: 'work', name: 'עבודה', emoji: '💼', color: 'purple' },
        { id: 'duv', name: 'דובדבן (בהתנדבות)', emoji: '🎗️', color: 'amber' },
        { id: 'pub', name: 'פעילות ציבורית', emoji: '🏛️', color: 'blue' },
        { id: 'army', name: 'שירות צבאי ומילואים', emoji: '🪖', color: 'gray' },
        { id: 'pers', name: 'יעדים - אישי', emoji: '🧘', color: 'yellow' },
        { id: 'study', name: 'יעדים - לימודי', emoji: '📚', color: 'rose' },
      ],
      bars: [
        b('acad', 0, 0, 'מיקוד באנגלית לקראת אמירנט'),
        b('acad', 1, 3, 'עקרונות פיתוח מערכות מידע + מושגי יסוד באקונומטריקה'),
        b('acad', 4, 4, 'מבחן אמיר"ם – מתקדמים ב\''),
        b('acad', 1, 4, 'סטטיסטיקה לתלמידי מדעי החברה ב + מבוא לפסיכולוגיה + אישיות: תאוריה ומחקר + השתתפות במחקרים'),
        b('entr', 0, 1, 'טיול לנפאל'),
        b('entr', 2, 4, 'MindWell – מוצר ופילוט'),
        b('entr', 0, 1, 'תוכנית "מלימודים לקריירה"'),
        b('entr', 2, 4, 'לוחמים לקריירה – השמה ראשונה וקשר עם חברות מובילות'),
        b('work', 1, 4, 'PUNCT – ניסיון CTO: העברת הפיתוח, מחולל קליטה, סליקה'),
        b('work', 0, 6, 'פרויקטית בפאודה – הכנסה צדדית קבועה'),
        b('duv', 0, 1, 'תפקיד זיויק'),
        b('duv', 2, 4, 'ליווי אופרטיבי והקלה על העו"סיות · סיכום 2026 עד 31.1'),
        b('duv', 0, 4, 'פרויקט עמית – 10 מנטורים בעזרה ראשונה נפשית'),
        b('pub', 1, 4, 'ישראל 2050 – הכשרה (רביעי 17:00–21:00) + קואליציה לבריאות הנפש'),
        b('pers', 0, 11, 'כל בוקר: תודה + שיחה לסבתא + לסדר את החדר · פסיכולוגית פעם בשבוע'),
        b('pers', 0, 11, 'אימון כל יום (שלישי ושבת לא חובה) + תזונה בריאה + תרגול נשימות'),
        b('pers', 0, 11, 'כל שבוע: משימות ויעדים שבועיים + ערב חופשי + יום כיף עם אח/ות + חצי יום מנוחה'),
        b('study', 0, 0, '3 שעות יומיות תרגול אנגלית'),
        b('study', 1, 6, 'אנגלית כל יום – יעד: מתקדמים ב\' בינואר'),
        b('study', 0, 0, '2 שיעורי אנגלית יומיים'),
        b('study', 1, 6, 'שיעור אנגלית יומי'),
      ],
    },
  ],
};
