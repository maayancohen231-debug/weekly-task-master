import type { Task, TaskStatus } from './task-types';

/** One-time import (2026-11-27): the board requests she finished in the week of 22.11,
 * merged into ~15 half-hour blocks a day (her ask), plus Thursday's aromatherapy workshop.
 * The planner then syncs them to Google Calendar like any scheduled task. */
const FLAG = 'week-import-2026-11-22';
const STORAGE_KEY = 'weekly-planner-data';
const WEEK = '2026-11-22';
const ITEMS: { id: string; content: string; dayId: string; startTime: string; durationMinutes: number; status: TaskStatus }[] = [
 {
  "id": "wk1122_0",
  "content": "Punct: משימות היום בפונקט: שלי ושל הצוות · טיפול בבאגים בלוח המשימות של Punct · לתקן את הבדיקה האוטומטית (CI) של punct-platform",
  "dayId": "sun",
  "startTime": "08:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_1",
  "content": "Punct: בדיקת דיוק מנוע ה-AI לפי התשובות החדשות · אפליקציה בסמסונג: כמות שמוקלדת נשמרת כ־1 בעגלה · מילון קיצורים למנוע ה-AI",
  "dayId": "sun",
  "startTime": "09:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_2",
  "content": "Punct: תמונת הכותרת באפליקציה חתוכה ומטושטשת · סדר ברשימת סוגי המוצר · דו\"ח המוצרים הנמכרים ביותר",
  "dayId": "sun",
  "startTime": "09:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_3",
  "content": "Punct: לתקן את הבדיקות האוטומטיות שנכשלות באפליקציה · מודרייטור מחליט אם מזמיני רכש רואים קטלוג · איחוד כפילויות בקטלוג",
  "dayId": "sun",
  "startTime": "10:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_4",
  "content": "Punct: לסגור את 14 הבאגים הפתוחים בלוח של פונקט · אפליקציה: \"שליחה לאישור\" נכשלת (הפעולה נכשלה) · מוצר אב ומוצרי בן בקטלוג",
  "dayId": "sun",
  "startTime": "10:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_5",
  "content": "דובדבן: סיכום חודשי למלגאי חוסן · עמוד \"באגים ובקשות\" משותף לכל המשתמשים · באגים ובקשות: בחירת העמוד מתוך רשימה",
  "dayId": "sun",
  "startTime": "11:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_6",
  "content": "Punct: אפליקציה: \"הזמנה חדשה\" נכשלת ומעוצבת כמו הישנה · מי יכול לערוך דרישה של אחר: מודרייטור ומודרייטור מוגבל · צ'אט האתר: \"היי אני צריכה להזמין מלט\" מציג מוצרים ומוסיף בלחיצה",
  "dayId": "sun",
  "startTime": "11:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_7",
  "content": "Punct: מיקרופון בחיפוש הקטלוג באתר הניסיון · מיקרופון בעוזר החכם · כפתור איחוד מוצרי בן",
  "dayId": "sun",
  "startTime": "12:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_8",
  "content": "Punct: מבנה בחירה: בלי מספרים, מחיקה והוספה של ערכים · כפתור יציאה לנועם באתר המשימות · הצעת איחוד ל־20 המוצרים הנרכשים",
  "dayId": "sun",
  "startTime": "12:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_9",
  "content": "Punct: העוזר החכם פותח איתי דרישה מההתחלה עד השליחה · מיפוי מוצר אב ← בחירות ← כמות (20 מוצרים) · להסתיר בינתיים את המיקרופון",
  "dayId": "sun",
  "startTime": "13:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_10",
  "content": "Punct: העברת לופו למערכת החדשה: הלילה, 22.11 מאוחר · העברת קבוצת טאוורס (חברה 55) למערכת החדשה · עוזר ההזמנה: בחירת סוג מוצר מסודרת, שלב אחרי שלב",
  "dayId": "sun",
  "startTime": "13:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_11",
  "content": "Punct: מסך קטלוג + פלואו: מוצר אב, סוגים והבחירות (מתחילים במלט) · סיסמה 12345678 לכל המשתמשים שעברו · אימון מנוע AI: בלי מסך \"מי עונה?\" בטעינה",
  "dayId": "sun",
  "startTime": "14:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_12",
  "content": "שונות: לוח בקשות חדש ויפה לכל הפרויקטים, מסונכרן עם Punct ודובדבן · לוח הבקשות עובר ל־Vercel · כפתורי ה־Dock פותחים חלון חדש במקום הפתוח · עובדי לילה של Claude במק · רילס לבר הוופל והצ׳ורוס של הדודה · רילס שני: בר הקינוחים של הדודה · חיבור סיילספורס במק · עיצוב חדש \"Espresso\" ליומן",
  "dayId": "sun",
  "startTime": "14:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_13",
  "content": "Punct: באג #272: שם הפרויקט מעל שם הספק ברשימת ההזמנות · תשובה לנועם: לופו בחדש, שאר הלקוחות בישן · נועם: לא מצליח להוסיף/למחוק מוצר בדרישה PR75341 במערכת הישנה",
  "dayId": "sun",
  "startTime": "15:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_14",
  "content": "Punct: צוות פאנקט באפליקציה: לופו/טאוורס בחדש, שאר הלקוחות בישן · בדיקה: האם גלי־זיו (בוארון) ורום גבס הזמינו היום · באג #273: מודרייטור לא רואה מחירים",
  "dayId": "sun",
  "startTime": "15:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_15",
  "content": "Punct: באג #275: אי אפשר לבחור ספק למוצר בדרישה באפליקציה · מראה חדש באפליקציה רק לחברות שעברו · רשימת בדיקות משותפת ללופו וטאוורס",
  "dayId": "mon",
  "startTime": "08:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_16",
  "content": "Punct: חיבור המערכת החדשה ל־Priority של לימון · דוח PDF למנהלים: מה פתרנו במעבר ומה עוד פתוח · לופו וטאוורס עדיין עובדים במערכת הישנה: לחסום ולהעביר",
  "dayId": "mon",
  "startTime": "09:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_17",
  "content": "Punct: סינון פרויקטים: רק פעילים · סקירה מלאה של קוד פונקט: כל הפלואו, כל סוגי המשתמשים, מקצה לקצה · כפיים: לבדוק למה נכשלה קבלת משלוח (הזמנה 97062)",
  "dayId": "mon",
  "startTime": "09:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_18",
  "content": "Punct: פרומט QA שרץ אחרי כל מעבר חברה · בדיקות: להפריד לופו וטאוורס לשני טאבים · דרישה חדשה באתר כמו באפליקציה: פרויקט ותאריך בלחיצה",
  "dayId": "mon",
  "startTime": "10:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_19",
  "content": "Punct: אפליקציה: תמונת הרקע בראש המסך בזום ענק · עדכון סטטוס בעמוד החברות · לימון: תמונת כסף מלאה מהפריורטי",
  "dayId": "mon",
  "startTime": "10:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_20",
  "content": "Punct: מייל הזמנה רק לכתובת שהחברה הגדירה לספק · מעבר 8 חברות לימון למערכת החדשה (הלילה) · QA מעבר 8 חברות לימון (155, 176, 198, 200, 205, 222, 227, 230)",
  "dayId": "mon",
  "startTime": "11:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_21",
  "content": "Punct: מעבר 8 חברות נוספות של לימון (רופל, טנוס, כפיר ועוד) · QA מעבר: 8 החברות הנוספות של לימון · יוצר הזמנות רואה מחירים דרך ה-API ובאפליקציה",
  "dayId": "mon",
  "startTime": "11:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_22",
  "content": "Punct: יוצר הזמנות יכול לערוך טיוטות של אחרים בפרויקט · מחירים שמורים חסרים בחברות שעברו · אפליקציה: צוות Punct רואה רק חברה אחת ולא יכול להוסיף מוצר (#553, #554) · בוארון (גלי זיו, חברה 223): מעבר למערכת החדשה",
  "dayId": "mon",
  "startTime": "12:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_23",
  "content": "דובדבן: כמה אנשי קשר לחירום בתיק הבוגר (איה) · לשבץ בגאנט 6 סדנאות הטרוגניות לכל הבוגרים · צילום מסך כבר בטופס באגים ובקשות",
  "dayId": "mon",
  "startTime": "12:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_24",
  "content": "Punct: רום גבס: להתחיל את המעבר למערכת החדשה · חשבון אדמין לנועם ועמית · בוארון: דרישות נכנסות ל־Priority עם מק\"ט כללי במקום לפי המיפוי",
  "dayId": "mon",
  "startTime": "13:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_25",
  "content": "דובדבן: בקשה פרטית בדף באגים ובקשות · מלגאים מוסיפים השתתפות בפעילות שבועית · בדיקה: האם בדיקת החדירות היום הצליחה לחדור",
  "dayId": "mon",
  "startTime": "13:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_26",
  "content": "Punct: עמית לא מצליחה להיכנס למשתמש הבדיקות של רום גבס · הגדרות חברה לא עברו מהמערכת הישנה (חסימת קטלוג כללי ועוד) · באפליקציה: מעבר בין חברות",
  "dayId": "mon",
  "startTime": "14:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_27",
  "content": "Punct: באג דחוף #582: באפליקציה תאריך האספקה בדרישה חדשה מסומן מראש על 29 לחודש · באג #557: הערת מוצר בדרישה מופיעה מתחת לקו · באג #556: במסך הזמנה שם הפרויקט למעלה במקום שם הספק",
  "dayId": "mon",
  "startTime": "14:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_28",
  "content": "Punct: שגיאת Application error בפתיחת האתר אצל עמית · באג #555: מחיר באדום בהזמנות ובדרישות כשלא הכול תומחר · באג #592: שליחה חוזרת לספק תסומן כתיקון הזמנה",
  "dayId": "mon",
  "startTime": "15:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_29",
  "content": "Punct: באג #591: שליחה לספק בלי לשאול אם לשלוח במייל · באג #590: ברשימת ההזמנות חסר טור הסכום אצל עמית · אפליקציה: \"כל החברות\" לצוות Punct, רשימות משותפות",
  "dayId": "mon",
  "startTime": "15:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_30",
  "content": "Punct: בדיקה 54 נכשלה: PDF עם מחירים ובלי מחירים · דרישות · דרישה חדשה · קטלוג",
  "dayId": "tue",
  "startTime": "08:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_31",
  "content": "Punct: באג: עאמר משלמה קופמן לא מצליח לפתוח דרישה · בוארון (גלי זיו) הגיעו למגבלת הקריאות של האינטגרציה · רום גבס: הסנכרון עם Priority מדלג על 6 מסמכים (כולל PR74909)",
  "dayId": "tue",
  "startTime": "09:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_32",
  "content": "דובדבן: הצפנת כל השדות הרגישים שעדיין גלויים · הכנת המערכת לבדיקת החדירות (בעוד יומיים) · לפני מבחן החדירות: חסימת תקיפות, הגבלת קצב, security.txt",
  "dayId": "tue",
  "startTime": "09:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_33",
  "content": "דובדבן: גיבוי לילי מוצפן של מסד הנתונים · ניתוק אחרי שעתיים בלי שימוש (מקס' 12 שעות) וחסימת גישה מחוץ לישראל · סריקת אבטחה לפני מבדק Cybiz",
  "dayId": "tue",
  "startTime": "10:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_34",
  "content": "Punct: בדיקת הגדרות חברה וקטלוג חברה בכל החברות שעברו · מסך דרישה: שורת מוצר קורסת במעבר עכבר · גשר Priority: שליפת שורות הזמנה איטית (עד 6 שניות מתוך 8)",
  "dayId": "tue",
  "startTime": "10:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_35",
  "content": "Punct: רשימות דרישות והזמנות באתר לא נטענות (נועם) · איפוס סיסמה: אישור שהמייל נשלח + אפשרות לראות את הסיסמה · מסך חברות לאדמין: כל החברות הפעילות, ישנה או חדשה",
  "dayId": "tue",
  "startTime": "11:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_36",
  "content": "דובדבן: סריקה תוקפנית מלאה לפני מבדק Cybiz · ראשי מחלקות יכולים למחוק אירועים · הידוק כלל העיצוב (CSP) בלי unsafe-inline",
  "dayId": "tue",
  "startTime": "11:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_37",
  "content": "Punct: תיק חברה לצוות Punct + התאמת מק\"טים: אפיון · אפיון: אזור ניהול של כל חברה · פרטים: מסגרת אזור החברה והלשונית פרטים",
  "dayId": "tue",
  "startTime": "12:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_38",
  "content": "Punct: ספקים ותשלום: חלק התשלום · קטלוג: ייבוא מאקסל, חיפוש וסינון · ספקים: המשך – ברירת מחדל לחברה וסוכן לפי פרויקט",
  "dayId": "tue",
  "startTime": "12:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_39",
  "content": "Punct: פרויקטים: תקציב, מנהל פרויקט, קבלנים ומשאבים · סטרוקטורה: קבלת משלוח תיסגר בפריוריטי לסטטוס סופית · משתמשים: סוגי הרשאה, משתמש בכמה חברות, view as ומחיקה",
  "dayId": "tue",
  "startTime": "13:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_40",
  "content": "דובדבן: להסתיר \"בלי מידע על בוגרים\" כשלא רלוונטי · מחלקה חדשה: Friends of Duvdevan · אנגלית למשתמשי Friends of Duvdevan",
  "dayId": "tue",
  "startTime": "13:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_41",
  "content": "Punct: תהליכים וחיבורים: עטיפת זרימות, שלבי אישור, חיבור Priority ויומן · קטלוג חברה: רק מחיר חברה, בלי \"מחיר קטלוג\" · משתמשים: צפייה כמשתמש אחר (לצוות) והסתרה ממשתמש שהוסר",
  "dayId": "tue",
  "startTime": "14:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_42",
  "content": "Punct: \"ספקים\" בתפריט: מסך ספקים כללי, נפרד מניהול החברה · קטלוג ומק״טים: העלאה לפרודקשן · קטלוג גלי זיו: כל המק\"טים חסרים + עריכת התאמה קיימת",
  "dayId": "tue",
  "startTime": "14:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_43",
  "content": "דובדבן: שם חדש למערכת במסך הכניסה · הוספה מחדש של משתמש שנמחק (אורן לביא) · איה (עו\"ס) לא מצליחה לערוך את הגאנט של אירוע",
  "dayId": "tue",
  "startTime": "15:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_44",
  "content": "Punct: הרשאות לכל חברה: ברירת מחדל + התאמות · שרת Railway גם לפרודקשן · התראה כשמק״ט חדש או שינוי אושר מול Priority",
  "dayId": "tue",
  "startTime": "15:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_45",
  "content": "Punct: הרשאות: עיצוב חדש + הסתרת \"מנהל קטלוג\" · כרטיס מוצר אחד לצוות Punct: כל הפעולות על מוצר במקום אחד · בדיקת מק״טים מול Priority האמיתי של רום ובוארון",
  "dayId": "wed",
  "startTime": "08:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_46",
  "content": "Punct: משוב קצר למשתמשי המערכת הישנה של Punct (קישור + הודעה באפליקציה) · המערכת נופלת לשניות ומסכי הזמנות/דרישות לא נטענים (כרטיסים 599, 600) · באג #604: מק״ט של סוג מוצר בעמודת \"מזהה וריאנט\"",
  "dayId": "wed",
  "startTime": "09:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_47",
  "content": "דובדבן: הוספת מיקום חדש מתוך בחירת המיקום באירוע · אזכרה: אפשרות לקבוע ידנית / לפי לועזי · אפשרות 'ללא מלגאי' בפתיחת אירוע",
  "dayId": "wed",
  "startTime": "09:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_48",
  "content": "דובדבן: סוג אוכלוסייה חדש: צוותים ותיקים (סיימו מילואים) · תיק חלל: משפחה שכולה לפני חברי צוות + לשונית תקשורת · אפשרות 'מחלקת הנצחה - אירוע / מיזם משפחתי' בפתיחת אירוע",
  "dayId": "wed",
  "startTime": "10:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_49",
  "content": "דובדבן: טבלת הרשאות נפרדת לכל מחלקה · קישור אירועי הנצחה לחלל או לכל המשפחות השכולות · כרטיס אדם: צוות במקום אחד במקום 4 בלוקים",
  "dayId": "wed",
  "startTime": "10:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_50",
  "content": "Punct: באג #605: מודרייטור לא רואה מוצרים לא פעילים בקטלוג החברה · כרטיס מוצר: תיאור ב־2 שורות + השוואת מחירים ליחידה · באגים #601 ו־#602: כמות בקבלת משלוח + חיפוש פרויקט בהזמנה חדשה",
  "dayId": "wed",
  "startTime": "11:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_51",
  "content": "דובדבן: חוסן: סטטוס קשר נגזר מהשיחות ובלי 'שלב בתהליך' כפול · כרטיס אדם: השתתפות ברשימה אחת · אירוע: תכנית חובה, קטגוריה ושם נגזרים",
  "dayId": "wed",
  "startTime": "11:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_52",
  "content": "דובדבן: צוות חדש: שדות מובנים, שם אוטומטי ובדיקת כפילות · אירוע וייבוא: התראת כפילות ונרמול טלפונים · נוכחות ממקור אחד",
  "dayId": "wed",
  "startTime": "12:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_53",
  "content": "Punct: גלי-זיו: הדרישה מגיעה לפריוריטי עם המק״ט הכללי במקום מק״ט החברה · כרטיס מוצר לפרודקשן (כולל מחיר ליחידה ותיאור קצר) · מק״ט חברה מגיע לפריוריטי בכל החברות עם אינטגרציה",
  "dayId": "wed",
  "startTime": "12:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_54",
  "content": "דובדבן: תפריט: חוסן אחד עם טאבים ומסך סיכומים אחד · להפסיק לקרוא את 'שלב בתהליך' הכללי בכל המסכים · רשימת ניקוי נתונים לאישור (כפילויות ודוגמאות)",
  "dayId": "wed",
  "startTime": "13:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_55",
  "content": "דובדבן: רשימה אחת לסוג/קהל/אוכלוסיית יעד · דוחות: אותו מספר לכל מדד בכל המסכים · תיק צוות: חלק \"שירות סדיר\" וחלק \"שירות מילואים\"",
  "dayId": "wed",
  "startTime": "13:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_56",
  "content": "דובדבן: תיקון כפילויות לפי ביקורת המערכת (אקסל 25.11) · שירות סדיר בתיק צוות: היחידה תמיד 217 · איש קשר לחירום תחת חוסן",
  "dayId": "wed",
  "startTime": "14:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_57",
  "content": "Punct: לשונית ספקים בכרטיס מוצר: תמונת מצב של ההזמנות לכל סוג · הלילה: העתקת המחירים הקיימים להיסטוריית המחירים בפרודקשן · סטרוקטורה (מערכת ישנה): הזמנות מפריוריטי לא מופיעות בפונקט",
  "dayId": "wed",
  "startTime": "14:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_58",
  "content": "דובדבן: תאריך לידה: בלי תאריכים עתידיים, ובחירת שנה לא נסגרת · עיצוב דף צוות לפי העיצוב בהורדות · חוסן: הכרת משהב\"ט ואחוז נכות רק למי שיש תיק הכרה",
  "dayId": "wed",
  "startTime": "15:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_59",
  "content": "דובדבן: כרטיס אדם › חברי צוות: שיוך לצוות קיים · גישה למערכת גם מארה\"ב · באגים ובקשות: רשימה במקום כרטיסיות",
  "dayId": "wed",
  "startTime": "15:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_60",
  "content": "Punct: מק\"טי חברות: לימון ומק\"ט Punct לחברות בלי אינטגרציה · באתר הבדיקות לכתוב שזו סביבת בדיקות · כפילויות: להציע איחוד סוגים שההבדל ביניהם רק האריזה · ספקי בדיקה וקטגוריה \"string\": למחוק?",
  "dayId": "thu",
  "startTime": "08:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_61",
  "content": "דובדבן: אייקונים פשוטים ואחידים בכרטיסיות העליונות · באגים ובקשות: מה שמנהל מערכת מעלה מוסתר אוטומטית · סיכום חודשי לפי עו\"סית (אקסל)",
  "dayId": "thu",
  "startTime": "09:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_62",
  "content": "דובדבן: כספים: העיצוב חתוך בסוף · תפריט: \"הפקת אירועים\" לחוסן · לוח שנה ראשי: שם + מחזור + מספר מפגש",
  "dayId": "thu",
  "startTime": "09:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_63",
  "content": "דובדבן: עריכת אירוע: אי אפשר לערוך מיקום ופרטים נוספים · אירוע: \"ללא מלגאי\" בבחירת מלגאי · נופלי היחידה: בלי רשימת כל המשפחות השכולות לכל חלל",
  "dayId": "thu",
  "startTime": "10:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_64",
  "content": "דובדבן: נופלי היחידה: קישור אירוע קיים מהלוח · נופלי היחידה: בלי KPI, אזכרות קרובות למסך הבית של הנצחה · נופלי היחידה: עריכת תאריך אזכרה בעיפרון",
  "dayId": "thu",
  "startTime": "10:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_65",
  "content": "דובדבן: \"לזכר\" רק באירוע הנצחה · תיק צוות: מנחים ריקים לא מוצגים, צוות שכול מוסתר אם לא סומן · תיקי צוותים: החיפוש שבור",
  "dayId": "thu",
  "startTime": "11:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_66",
  "content": "Punct: עמוד \"באגים ובקשות\" בפונקט לצוות פונקט · באגים ובקשות: 4 הפריטים שהעלית בעמוד · באגים ובקשות: 4 פריטים על הקטלוג",
  "dayId": "thu",
  "startTime": "11:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_67",
  "content": "Punct: כרטיס מוצר › מק״ט חברות: כל חברה בשורה נפרדת · באגים ובקשות: \"הבקשות שלי\" ו\"בקשות שלי שטופלו\" · באגים ובקשות: כמה צילומי מסך לפריט",
  "dayId": "thu",
  "startTime": "12:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_68",
  "content": "Punct: השוואת מחירים: אקסל למוצר והיסטוריית מחירים · מיפוי מק״טים: חיפוש לפי מק״ט סוג, תיאורים מפריוריטי, פריהד · פרומט לקלוד בכרום: סריקת חוויית משתמש",
  "dayId": "thu",
  "startTime": "12:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_69",
  "content": "דובדבן: נתוני חוסן: לצמצם גלילה, פירוט לפי דרישה · בדיקת רגרסיה אחרי ~40 השינויים של 25.11 · כניסה עם Face ID / טביעת אצבע / PIN",
  "dayId": "thu",
  "startTime": "13:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_70",
  "content": "דובדבן: להעביר את האירוע \"פרסום מבט מקרוב פצועים\" לתכנית של חוסן · נתונים לסמדר: הפניות לטיפול, פסיכיאטר, ליווי להכרה · תיקי צוות: כולם רואים ועורכים, פרטים רגישים רק לעו\"סיות ולי",
  "dayId": "thu",
  "startTime": "13:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_71",
  "content": "Punct: יחידות מידה קוב/מ״ק, בועת AI זזה, חיפוש חברה · בקשה לפתיחת מק״ט חדש ממנהל הזמנות · מסכים לצוות Punct: ספק חדש, עדכון ספק ומשתמש חדש",
  "dayId": "thu",
  "startTime": "14:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_72",
  "content": "Punct: הערה גם באישור, במסך השאלות לנועם · תהליכי אישור שונים לפי חברה: מה צריך במערכת החדשה · מעבר לקוחות למערכת החדשה: חברה-חברה, אותה אפליקציה ואותו קישור",
  "dayId": "thu",
  "startTime": "14:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_73",
  "content": "Punct: עמוד באגים ובקשות: מחכות לתשובה ממני, דחוף, ופחות טקסטים · בוארון: השלמה אחרי ההפעלה לא רצה (5 דרישות חסרות) · מסך פתיחה מונפש לאפליקציה + לוגו וקטורי",
  "dayId": "thu",
  "startTime": "15:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_74",
  "content": "Punct: מדידת דיוק מנוע ה-AI כל ערב · בוארון (גלי זיו), מודרייטור מוגבל: כפתור אישור מיד אחרי \"שלח לאישור\" · לחבר את מנוע ה-AI לתשובות האימון + עוד שאלות",
  "dayId": "thu",
  "startTime": "15:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_75",
  "content": "Punct: מבנה מחירים חדש: שלב 0, בדיקה ומסמך · אפליקציה: \"אין הרשאה\" בקריאת הגדרות החברה · הגדרות חברה: בורר חברה כפול",
  "dayId": "fri",
  "startTime": "08:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_76",
  "content": "Punct: אדמינים חדשים לעובדי המשרד (רשימה של עמית) · צ'אט האפליקציה: \"היי אני צריכה להזמין מלט\" מציג מוצרים ומוסיף בלחיצה · תיקון ממצאי ה־UX Audit בהדרגה",
  "dayId": "fri",
  "startTime": "09:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_77",
  "content": "Punct: מסך דרישה: 9 פריטים מעמוד באגים ובקשות · חלונות דרישה חדשה והזמנה חדשה: 7 פריטים מעמוד באגים ובקשות · קטלוג: שמות אחידים, תיקון שמות הפוכים ומסך הוספת מוצר",
  "dayId": "fri",
  "startTime": "09:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_78",
  "content": "Punct: רישום שימוש בצ'אט (מי, מאיזו חברה, מתי, מה נשאל) · לחבר מפתח AI לצ'אט באתר החי · רשימות דרישות והזמנות: 15 פריטים מעמוד באגים ובקשות",
  "dayId": "fri",
  "startTime": "10:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_79",
  "content": "Punct: סטרוקטורה: סטטוס סופי בפריוריטי אחרי קבלת משלוח · חיפוש הזמנה או דרישה לפי הספרות האחרונות · צילום תעודת משלוח: זיהוי אוטומטי של מספר התעודה",
  "dayId": "fri",
  "startTime": "10:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_80",
  "content": "Punct: אזור החברה: \"כללי חברה\" נפתח בעמוד אחר ולא באותו פורמט · מסך דרישה והזמנה: כל עמודות שורת המוצר תמיד נראות · חברה שנפתחת במערכת החדשה מסומנת בטעות \"ישנה\"",
  "dayId": "fri",
  "startTime": "11:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_81",
  "content": "Punct: סוג משתמש חדש: צוות תמיכה טכנית · סרטון שיווקי: מהשטח לרכש ולספק · איפוס סיסמה עצמי לא עובד (ירדן מפריהד)",
  "dayId": "fri",
  "startTime": "11:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_82",
  "content": "Punct: שימוש בצ'אט: רק למעיין · איחוד שני חשבונות של אותו אדם · איפוס סיסמה ל־tarekabdul@gmail.com",
  "dayId": "fri",
  "startTime": "12:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_83",
  "content": "Punct: אפליקציה: \"הוספה להזמנה\" לא מוסיף את המוצר · כותרת טבלה קפואה בכל העמודים · באגים ובקשות: בחירת עמוד עם חיפוש בהקלדה",
  "dayId": "fri",
  "startTime": "12:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_84",
  "content": "Punct: מסך צוות Punct: כל המשתמשים במערכת + איפוס סיסמה + צפייה כמשתמש · ספק חדש: טלפון ומייל לא חובה · באגים ובקשות: שמירת פריט לוקחת הרבה זמן",
  "dayId": "fri",
  "startTime": "13:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_85",
  "content": "Punct: מוצרים בווב: כל העמודות בלי גלילה הצידה · כל האינטגרציות: כל תמונות תעודת המשלוח לנספחים בפריוריטי · מחיר והנחה בשורות הזמנה שסופקה / סופקה חלקית",
  "dayId": "fri",
  "startTime": "13:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_86",
  "content": "Punct: שם המוצר מפריוריטי נוסף אוטומטית כשם נרדף · חיפוש מוצרים חכם כמו בגוגל (גם עם שגיאות כתיב) · אפיון הוספת חברה חדשה מהמסך",
  "dayId": "fri",
  "startTime": "14:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_87",
  "content": "דובדבן: דף אירוע: בחירת נוכחים מתוך הצוות המחובר · דף אירוע: לבחור נוכחים מתוך הצוות · תיקי צוותים: כולם רואים, פרטים רגישים רק לעו\"ס ולמנהלת",
  "dayId": "fri",
  "startTime": "14:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_88",
  "content": "Punct: סרטון קצר לשטח של סטרוקטורה · בדיקה בדפדפן של שינויים שעלו בלי בדיקה במסך · העוזר החכם באתר לא מזהה מוצרים · אלישר: ישראל פרבר לא יכול לשלוח דרישה",
  "dayId": "fri",
  "startTime": "15:00",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_89",
  "content": "דובדבן: הרצת כל הבדיקות אחרי שינויי היום · תהליך הכרה: שלב \"הגיש החמרת מצב\" · אנשי קשר לחירום: למטה, אחד בברירת מחדל, הוספת עוד · מסגרת אינטנסיבית: לפרטים, לא לתיעוד שיחה",
  "dayId": "fri",
  "startTime": "15:30",
  "durationMinutes": 30,
  "status": "green"
 },
 {
  "id": "wk1122_aroma",
  "content": "סדנת ארומה תרפייה בתל אביב",
  "dayId": "thu",
  "startTime": "19:00",
  "durationMinutes": 120,
  "status": "none"
 }
];

export function importWeekTasks(): void {
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
      week.push({ ...it, color: 'none', isDaily: false, sortOrder: order++ });
    }
    data.tasksByWeek[WEEK] = week;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(FLAG, '1');
  } catch { /* ignore */ }
}
