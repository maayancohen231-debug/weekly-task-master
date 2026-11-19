import type { Task } from './task-types';

/** One-time import (2026-11-19): the Punct tasks she finished on 18-19 Nov, as done 30-minute blocks. */
const FLAG = 'punct-import-2026-11-19';
const STORAGE_KEY = 'weekly-planner-data';
const WEEK = '2026-11-15';
const ITEMS: { id: string; content: string; dayId: string; startTime: string; durationMinutes: number }[] = [
 {
  "id": "punct_4",
  "content": "פונקט: לתחקר את הבאגים באינטגרציה בין פריורטי לPUNCT",
  "dayId": "wed",
  "startTime": "07:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_8",
  "content": "פונקט: בדיקות של שליחת מיילים",
  "dayId": "wed",
  "startTime": "07:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_18",
  "content": "פונקט: העלאה לפרודקשן: התראות מייל + אייקוני סטטוס + משאב חובה",
  "dayId": "wed",
  "startTime": "08:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_43",
  "content": "פונקט: צור הזמנות",
  "dayId": "wed",
  "startTime": "08:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_44",
  "content": "פונקט: תפקידים שצריכים להיות יכולים להוסיף מחיר למוצר",
  "dayId": "wed",
  "startTime": "09:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_45",
  "content": "פונקט: הקטלוג לא חשוף לקבלת משלוח ללא הזמנה",
  "dayId": "wed",
  "startTime": "09:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_46",
  "content": "פונקט: שינוי סטטוס",
  "dayId": "wed",
  "startTime": "10:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_47",
  "content": "פונקט: קבלת משלוח",
  "dayId": "wed",
  "startTime": "10:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_48",
  "content": "פונקט: שינוי צבעים",
  "dayId": "wed",
  "startTime": "11:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_49",
  "content": "פונקט: שכפל והורד",
  "dayId": "wed",
  "startTime": "11:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_52",
  "content": "פונקט: טעינת pdf",
  "dayId": "wed",
  "startTime": "12:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_53",
  "content": "פונקט: שליחת הזמנה אוטמטית מהמערכת",
  "dayId": "wed",
  "startTime": "12:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_54",
  "content": "פונקט: העתקה חסרה",
  "dayId": "wed",
  "startTime": "13:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_57",
  "content": "פונקט: ״עזרה?״- להעביר את הבועה למטה",
  "dayId": "wed",
  "startTime": "13:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_58",
  "content": "פונקט: לוח דרישות מבולגן - ממשק חדש",
  "dayId": "wed",
  "startTime": "14:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_59",
  "content": "פונקט: העברת לופו למערכת החדשה",
  "dayId": "wed",
  "startTime": "14:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_60",
  "content": "פונקט: הקמת סביבת ייצור למערכת החדשה",
  "dayId": "wed",
  "startTime": "15:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_61",
  "content": "פונקט: חיבור האפליקציה הקיימת למערכת החדשה",
  "dayId": "wed",
  "startTime": "15:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_63",
  "content": "פונקט: תאריכים שגויים אחרי חצות, ותיקוני תצוגה ממעבר לילה על המסכים",
  "dayId": "wed",
  "startTime": "16:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_65",
  "content": "פונקט: להוריד \"תהליך אספקה\"",
  "dayId": "wed",
  "startTime": "16:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_68",
  "content": "פונקט: טר דרישות והזמנות - לפי תאריך/סטטוס/פרויקט",
  "dayId": "wed",
  "startTime": "17:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_69",
  "content": "פונקט: אימוגים",
  "dayId": "wed",
  "startTime": "17:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_70",
  "content": "פונקט: הבחירת מוצרים נטענת ממש לאט",
  "dayId": "wed",
  "startTime": "18:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_73",
  "content": "פונקט: חייבים לראות את המספר דרישה והזמנה בשורות שלהן",
  "dayId": "wed",
  "startTime": "18:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_74",
  "content": "פונקט: חייבים לראות גם שורה של הערות כלליות בהזמנה בדף הראשי",
  "dayId": "wed",
  "startTime": "19:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_75",
  "content": "פונקט: ברגע שנכנסים להוספת מוצרים זה לרגע מראה מוצרים לא קשורים ואז רק מראה…",
  "dayId": "wed",
  "startTime": "19:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_76",
  "content": "פונקט: ברגע שמחפשים מוצר זה עדיין מראה את המוצר שהוזמן לאחרונה גם אם לא חיפ…",
  "dayId": "wed",
  "startTime": "20:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_77",
  "content": "פונקט: שלוחצים על קבלת משלוח שזה יסדר את ההזמנות לפי תאריך",
  "dayId": "wed",
  "startTime": "20:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_78",
  "content": "פונקט: להשאיר סטטוסים של דרישות והזמנות באותו שם בממשק החדש",
  "dayId": "wed",
  "startTime": "21:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_79",
  "content": "פונקט: בכללי שהרשימת דרישות והזמנות יהיו מסודרות לפי תאריך כרונולוגי ולא סט…",
  "dayId": "wed",
  "startTime": "21:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_81",
  "content": "פונקט: ברגע שנכנסים להוסיף מוצרים ומופיע מוצר שיהיה אפשר להכנס אליו שלוחצים…",
  "dayId": "thu",
  "startTime": "07:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_82",
  "content": "פונקט: שצריך לבחור סוג מוצר בתוך המוצר עצמו שיהיה רשימה נפתחת ברגע שלוחצים…",
  "dayId": "thu",
  "startTime": "07:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_83",
  "content": "פונקט: סיכום הדרישה",
  "dayId": "thu",
  "startTime": "08:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_84",
  "content": "פונקט: צריך גם אופציה לבחור ספק לכלל הסוגי מוצר בדרישה איפה שהקפתי",
  "dayId": "thu",
  "startTime": "08:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_85",
  "content": "פונקט: מודיירטור לימיטד ומודרייטור",
  "dayId": "thu",
  "startTime": "09:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_86",
  "content": "פונקט: לא רואה שגם בתוך המוצר יש אופציה למודרייטור לימיטד לבחור ספק",
  "dayId": "thu",
  "startTime": "09:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_87",
  "content": "פונקט: המשלוח התקבל",
  "dayId": "thu",
  "startTime": "10:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_88",
  "content": "פונקט: המשלוח התקבל",
  "dayId": "thu",
  "startTime": "10:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_89",
  "content": "פונקט: דרישה חדשה · קטלוג",
  "dayId": "thu",
  "startTime": "11:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_90",
  "content": "פונקט: פרטי הזמנה",
  "dayId": "thu",
  "startTime": "11:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_91",
  "content": "פונקט: בהזמנה רכש",
  "dayId": "thu",
  "startTime": "12:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_92",
  "content": "פונקט: חוסם: דרישה מאושרת מיד אחרי שליחה",
  "dayId": "thu",
  "startTime": "12:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_93",
  "content": "פונקט: חוסם: אי אפשר לבטל שליחה של דרישה",
  "dayId": "thu",
  "startTime": "13:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_94",
  "content": "פונקט: חוסם: השלמת טיוטה מהרשימה שבורה",
  "dayId": "thu",
  "startTime": "13:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_95",
  "content": "פונקט: חוסם: אחרי \"המשלוח התקבל\" אי אפשר לצאת מהמסך",
  "dayId": "thu",
  "startTime": "14:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_100",
  "content": "פונקט: סיכום הדרישה",
  "dayId": "thu",
  "startTime": "14:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_101",
  "content": "פונקט: דרישות: אפשר להוסיף מוצרים לדרישה שכבר נשלחה, כי הטיוטה לא מתאפסת",
  "dayId": "thu",
  "startTime": "15:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_102",
  "content": "פונקט: דרישות: תגית \"ברירת מחדל\" מופיעה על פרויקט שלא נבחר",
  "dayId": "thu",
  "startTime": "15:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_103",
  "content": "פונקט: דרישות: לחיצה מהירה על שני \"+\" מאבדת מוצר",
  "dayId": "thu",
  "startTime": "16:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_104",
  "content": "פונקט: דרישות: פתיחת מוצר יוצרת דרישה, וחזרה משאירה טיוטה ריקה",
  "dayId": "thu",
  "startTime": "16:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_105",
  "content": "פונקט: דרישות: בסיכום, מחיקת מוצר שנכשלה משאירה אותו נשלח למרות שהוא מוסתר",
  "dayId": "thu",
  "startTime": "17:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_106",
  "content": "פונקט: דרישות: בסיכום, המקלדת מכסה את שדה ההערה",
  "dayId": "thu",
  "startTime": "17:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_107",
  "content": "פונקט: דרישות: בסיכום, לחיצה כפולה על \"שליחה לרכש\" או על +/- מאבדת כמות",
  "dayId": "thu",
  "startTime": "18:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_108",
  "content": "פונקט: דרישות: בפרטי דרישה אין הודעת שגיאה ואין רענון",
  "dayId": "thu",
  "startTime": "18:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_109",
  "content": "פונקט: דרישות: אפשר לבחור שבת או חג מהיומן",
  "dayId": "thu",
  "startTime": "19:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_110",
  "content": "פונקט: דרישות: ביטול מחיקה קיים רק למוצר האחרון",
  "dayId": "thu",
  "startTime": "19:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_111",
  "content": "פונקט: דרישות: ניסוח \"1 מוצרים\" ו\"עוד 1 פרויקטים\" בלשון רבים",
  "dayId": "thu",
  "startTime": "20:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_112",
  "content": "פונקט: דרישות: תאריכים לפי אזור הזמן של הטלפון ולא של ישראל",
  "dayId": "thu",
  "startTime": "20:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_113",
  "content": "פונקט: הזמנות וקבלת משלוח: כפתור צילום התעודה מופיע גם להזמנה שאי אפשר לקבל",
  "dayId": "thu",
  "startTime": "21:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_114",
  "content": "פונקט: הזמנות וקבלת משלוח: בפרטי הזמנה, אם מעבר סטטוס נכשל הטעינה נשארת לנצח",
  "dayId": "thu",
  "startTime": "21:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_115",
  "content": "פונקט: הזמנות וקבלת משלוח: תאריך ברירת המחדל בהזמנה חדשה לא מתעדכן אחרי חצות",
  "dayId": "thu",
  "startTime": "22:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_116",
  "content": "פונקט: הזמנות וקבלת משלוח: בהתאמה למשלוח, כמות שכבר סופקה נשלחת שוב",
  "dayId": "thu",
  "startTime": "22:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_117",
  "content": "פונקט: הזמנות וקבלת משלוח: בהתאמה למשלוח, שינויים אובדים ברענון",
  "dayId": "thu",
  "startTime": "23:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_118",
  "content": "פונקט: הזמנות וקבלת משלוח: העלאת תעודה שנכשלה לא ניתנת לניסיון חוזר",
  "dayId": "thu",
  "startTime": "07:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_119",
  "content": "פונקט: הזמנות וקבלת משלוח: טעינה שנכשלה מציגה טופס ריק",
  "dayId": "thu",
  "startTime": "07:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_120",
  "content": "פונקט: הזמנות וקבלת משלוח: רשימת ההזמנות מציגה רק את 20 האחרונות",
  "dayId": "thu",
  "startTime": "08:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_121",
  "content": "פונקט: הזמנות וקבלת משלוח: כפתור צילום התעודה ברשימה רק מסנן ולא פותח מצלמה",
  "dayId": "thu",
  "startTime": "08:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_122",
  "content": "פונקט: הזמנות וקבלת משלוח: אותו סכום מופיע פעמיים בשני פורמטים",
  "dayId": "thu",
  "startTime": "09:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_123",
  "content": "פונקט: הזמנות וקבלת משלוח: סכום הקטלוג מתעלם מהנחה כללית",
  "dayId": "thu",
  "startTime": "09:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_124",
  "content": "פונקט: הזמנות וקבלת משלוח: כפתור החזרה במסך הקבלה כתוב \"צילום מחדש\" אבל רק…",
  "dayId": "thu",
  "startTime": "10:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_125",
  "content": "פונקט: הזמנות וקבלת משלוח: כרטיסי תעודה וחלונות בקבלה עדיין בעיצוב ישן",
  "dayId": "thu",
  "startTime": "10:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_126",
  "content": "פונקט: הזמנות וקבלת משלוח: אין לשוניות \"פתוחות\" ו\"התקבלו\" בטאב ההזמנות, והמ…",
  "dayId": "thu",
  "startTime": "11:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_127",
  "content": "פונקט: כללי באפליקציה: צ'אט העוזרת מציג \"צריך להתחבר מחדש\" אחרי שעה",
  "dayId": "thu",
  "startTime": "11:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_128",
  "content": "פונקט: כללי באפליקציה: \"הצג סיור שוב\" מופעל מעל ההגדרות והסימונים מצביעים ע…",
  "dayId": "thu",
  "startTime": "12:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_129",
  "content": "פונקט: כללי באפליקציה: טאבי התחתית נעלמים ומופיעים באמצע הזרימה",
  "dayId": "thu",
  "startTime": "12:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_130",
  "content": "פונקט: כללי באפליקציה: גודל טקסט גדול חותך כפתורים",
  "dayId": "thu",
  "startTime": "13:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_132",
  "content": "פונקט: כללי באפליקציה: כפתורי חזרה קטנים מ־44",
  "dayId": "thu",
  "startTime": "13:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_134",
  "content": "פונקט: כללי באפליקציה: מצב כהה: רקע כהה מבצבץ בין מסכים",
  "dayId": "thu",
  "startTime": "14:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_137",
  "content": "פונקט: כללי באפליקציה: המדריך של הצ'אט מכיר את הזרימה הישנה (\"שלח לאישור\",…",
  "dayId": "thu",
  "startTime": "14:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_138",
  "content": "פונקט: שרת ונתונים: אין סטטוסים \"הספק אישר\" ו\"בדרך\", ולכן פס השלבים לא מגיע…",
  "dayId": "thu",
  "startTime": "15:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_143",
  "content": "פונקט: שרת ונתונים: אין טעינת המשך ברשימת הדרישות",
  "dayId": "thu",
  "startTime": "15:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_144",
  "content": "פונקט: שרת ונתונים: פרטי דרישה שולחים שאילתה נפרדת לכל הזמנה, כל אחת כ־0.56…",
  "dayId": "thu",
  "startTime": "16:00",
  "durationMinutes": 30
 },
 {
  "id": "punct_147",
  "content": "פונקט: שרת ונתונים: 8 מתוך 30 דרישות הדוגמה הן טיוטות ריקות",
  "dayId": "thu",
  "startTime": "16:30",
  "durationMinutes": 30
 },
 {
  "id": "punct_148",
  "content": "פונקט: שרת ונתונים: הקטלוג של החברה לדוגמה קטן, רק 14 מוצרים, ולחלקם עשרות…",
  "dayId": "thu",
  "startTime": "17:00",
  "durationMinutes": 30
 }
];

export function importPunctTasks(): void {
  try {
    if (localStorage.getItem(FLAG)) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { tasksByWeek: {}, goalsByWeek: {}, libraryTasks: [] };
    data.tasksByWeek ??= {};
    const week: Task[] = data.tasksByWeek[WEEK] ?? [];
    const have = new Set(week.map(t => t.id));
    let order = week.length;
    for (const it of ITEMS) {
      if (have.has(it.id)) continue;
      week.push({ ...it, status: 'green', color: 'amber', isDaily: false, sortOrder: order++ });
    }
    data.tasksByWeek[WEEK] = week;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(FLAG, '1');
  } catch { /* ignore */ }
}
