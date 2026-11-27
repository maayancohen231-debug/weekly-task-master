import type { Task } from './task-types';
import { formatLocalDateTime } from './task-types';
import {
  type GCalCalendar, type GCalBusyEvent, type SyncedEventInfo,
  loadSyncedEvents, saveAllSyncedEvents, updateCalendarEvent, moveCalendarEvent,
  deleteCalendarEvent, fetchWeekEvents, resolveLearnedOrRuleMatch,
} from '@/services/googleCalendar';

/** The board requests she finished in the week of 22.11.2026 (R-820), as half-hour
 * blocks filling every day Sun–Fri from 08:00 to 23:00, one or two requests a block,
 * all in English, plus Thursday's aromatherapy workshop 19:00–21:00.
 *
 * v1 (9941bb2) put 90 Hebrew blocks (wk1122_0..89 + wk1122_aroma) 08:30–16:00 and the
 * planner already synced them to Google. v2 keeps those ids for its first blocks, so
 * `resyncWeekImport` can PATCH the same Google events (title, time, calendar) instead
 * of leaving Hebrew orphans, and adds wk1122_90..163 for the rest. */
const FLAG_V1 = 'week-import-2026-11-22';
const FLAG = 'week-import-2026-11-22-v4';
const RESYNC_FLAG = 'week-import-2026-11-22-v4-resync';
const STORAGE_KEY = 'weekly-planner-data';
export const WEEK_IMPORT_WEEK = '2026-11-22';
const WEEK = WEEK_IMPORT_WEEK;
export const WEEK_IMPORT_ID_PREFIX = 'wk1122_';
const AROMA_ID = 'wk1122_aroma';
const AROMA_TITLE = 'Aromatherapy workshop, Tel Aviv';
const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** v1 titles by id: the Google events still carrying them get renamed or deleted. */
const OLD_TITLES: Record<string, string> = {
 "wk1122_0": "Punct: משימות היום בפונקט: שלי ושל הצוות · טיפול בבאגים בלוח המשימות של Punct · לתקן את הבדיקה האוטומטית (CI) של punct-platform",
 "wk1122_1": "Punct: בדיקת דיוק מנוע ה-AI לפי התשובות החדשות · אפליקציה בסמסונג: כמות שמוקלדת נשמרת כ־1 בעגלה · מילון קיצורים למנוע ה-AI",
 "wk1122_2": "Punct: תמונת הכותרת באפליקציה חתוכה ומטושטשת · סדר ברשימת סוגי המוצר · דו\"ח המוצרים הנמכרים ביותר",
 "wk1122_3": "Punct: לתקן את הבדיקות האוטומטיות שנכשלות באפליקציה · מודרייטור מחליט אם מזמיני רכש רואים קטלוג · איחוד כפילויות בקטלוג",
 "wk1122_4": "Punct: לסגור את 14 הבאגים הפתוחים בלוח של פונקט · אפליקציה: \"שליחה לאישור\" נכשלת (הפעולה נכשלה) · מוצר אב ומוצרי בן בקטלוג",
 "wk1122_5": "דובדבן: סיכום חודשי למלגאי חוסן · עמוד \"באגים ובקשות\" משותף לכל המשתמשים · באגים ובקשות: בחירת העמוד מתוך רשימה",
 "wk1122_6": "Punct: אפליקציה: \"הזמנה חדשה\" נכשלת ומעוצבת כמו הישנה · מי יכול לערוך דרישה של אחר: מודרייטור ומודרייטור מוגבל · צ'אט האתר: \"היי אני צריכה להזמין מלט\" מציג מוצרים ומוסיף בלחיצה",
 "wk1122_7": "Punct: מיקרופון בחיפוש הקטלוג באתר הניסיון · מיקרופון בעוזר החכם · כפתור איחוד מוצרי בן",
 "wk1122_8": "Punct: מבנה בחירה: בלי מספרים, מחיקה והוספה של ערכים · כפתור יציאה לנועם באתר המשימות · הצעת איחוד ל־20 המוצרים הנרכשים",
 "wk1122_9": "Punct: העוזר החכם פותח איתי דרישה מההתחלה עד השליחה · מיפוי מוצר אב ← בחירות ← כמות (20 מוצרים) · להסתיר בינתיים את המיקרופון",
 "wk1122_10": "Punct: העברת לופו למערכת החדשה: הלילה, 22.11 מאוחר · העברת קבוצת טאוורס (חברה 55) למערכת החדשה · עוזר ההזמנה: בחירת סוג מוצר מסודרת, שלב אחרי שלב",
 "wk1122_11": "Punct: מסך קטלוג + פלואו: מוצר אב, סוגים והבחירות (מתחילים במלט) · סיסמה 12345678 לכל המשתמשים שעברו · אימון מנוע AI: בלי מסך \"מי עונה?\" בטעינה",
 "wk1122_12": "שונות: לוח בקשות חדש ויפה לכל הפרויקטים, מסונכרן עם Punct ודובדבן · לוח הבקשות עובר ל־Vercel · כפתורי ה־Dock פותחים חלון חדש במקום הפתוח · עובדי לילה של Claude במק · רילס לבר הוופל והצ׳ורוס של הדודה · רילס שני: בר הקינוחים של הדודה · חיבור סיילספורס במק · עיצוב חדש \"Espresso\" ליומן",
 "wk1122_13": "Punct: באג #272: שם הפרויקט מעל שם הספק ברשימת ההזמנות · תשובה לנועם: לופו בחדש, שאר הלקוחות בישן · נועם: לא מצליח להוסיף/למחוק מוצר בדרישה PR75341 במערכת הישנה",
 "wk1122_14": "Punct: צוות פאנקט באפליקציה: לופו/טאוורס בחדש, שאר הלקוחות בישן · בדיקה: האם גלי־זיו (בוארון) ורום גבס הזמינו היום · באג #273: מודרייטור לא רואה מחירים",
 "wk1122_15": "Punct: באג #275: אי אפשר לבחור ספק למוצר בדרישה באפליקציה · מראה חדש באפליקציה רק לחברות שעברו · רשימת בדיקות משותפת ללופו וטאוורס",
 "wk1122_16": "Punct: חיבור המערכת החדשה ל־Priority של לימון · דוח PDF למנהלים: מה פתרנו במעבר ומה עוד פתוח · לופו וטאוורס עדיין עובדים במערכת הישנה: לחסום ולהעביר",
 "wk1122_17": "Punct: סינון פרויקטים: רק פעילים · סקירה מלאה של קוד פונקט: כל הפלואו, כל סוגי המשתמשים, מקצה לקצה · כפיים: לבדוק למה נכשלה קבלת משלוח (הזמנה 97062)",
 "wk1122_18": "Punct: פרומט QA שרץ אחרי כל מעבר חברה · בדיקות: להפריד לופו וטאוורס לשני טאבים · דרישה חדשה באתר כמו באפליקציה: פרויקט ותאריך בלחיצה",
 "wk1122_19": "Punct: אפליקציה: תמונת הרקע בראש המסך בזום ענק · עדכון סטטוס בעמוד החברות · לימון: תמונת כסף מלאה מהפריורטי",
 "wk1122_20": "Punct: מייל הזמנה רק לכתובת שהחברה הגדירה לספק · מעבר 8 חברות לימון למערכת החדשה (הלילה) · QA מעבר 8 חברות לימון (155, 176, 198, 200, 205, 222, 227, 230)",
 "wk1122_21": "Punct: מעבר 8 חברות נוספות של לימון (רופל, טנוס, כפיר ועוד) · QA מעבר: 8 החברות הנוספות של לימון · יוצר הזמנות רואה מחירים דרך ה-API ובאפליקציה",
 "wk1122_22": "Punct: יוצר הזמנות יכול לערוך טיוטות של אחרים בפרויקט · מחירים שמורים חסרים בחברות שעברו · אפליקציה: צוות Punct רואה רק חברה אחת ולא יכול להוסיף מוצר (#553, #554) · בוארון (גלי זיו, חברה 223): מעבר למערכת החדשה",
 "wk1122_23": "דובדבן: כמה אנשי קשר לחירום בתיק הבוגר (איה) · לשבץ בגאנט 6 סדנאות הטרוגניות לכל הבוגרים · צילום מסך כבר בטופס באגים ובקשות",
 "wk1122_24": "Punct: רום גבס: להתחיל את המעבר למערכת החדשה · חשבון אדמין לנועם ועמית · בוארון: דרישות נכנסות ל־Priority עם מק\"ט כללי במקום לפי המיפוי",
 "wk1122_25": "דובדבן: בקשה פרטית בדף באגים ובקשות · מלגאים מוסיפים השתתפות בפעילות שבועית · בדיקה: האם בדיקת החדירות היום הצליחה לחדור",
 "wk1122_26": "Punct: עמית לא מצליחה להיכנס למשתמש הבדיקות של רום גבס · הגדרות חברה לא עברו מהמערכת הישנה (חסימת קטלוג כללי ועוד) · באפליקציה: מעבר בין חברות",
 "wk1122_27": "Punct: באג דחוף #582: באפליקציה תאריך האספקה בדרישה חדשה מסומן מראש על 29 לחודש · באג #557: הערת מוצר בדרישה מופיעה מתחת לקו · באג #556: במסך הזמנה שם הפרויקט למעלה במקום שם הספק",
 "wk1122_28": "Punct: שגיאת Application error בפתיחת האתר אצל עמית · באג #555: מחיר באדום בהזמנות ובדרישות כשלא הכול תומחר · באג #592: שליחה חוזרת לספק תסומן כתיקון הזמנה",
 "wk1122_29": "Punct: באג #591: שליחה לספק בלי לשאול אם לשלוח במייל · באג #590: ברשימת ההזמנות חסר טור הסכום אצל עמית · אפליקציה: \"כל החברות\" לצוות Punct, רשימות משותפות",
 "wk1122_30": "Punct: בדיקה 54 נכשלה: PDF עם מחירים ובלי מחירים · דרישות · דרישה חדשה · קטלוג",
 "wk1122_31": "Punct: באג: עאמר משלמה קופמן לא מצליח לפתוח דרישה · בוארון (גלי זיו) הגיעו למגבלת הקריאות של האינטגרציה · רום גבס: הסנכרון עם Priority מדלג על 6 מסמכים (כולל PR74909)",
 "wk1122_32": "דובדבן: הצפנת כל השדות הרגישים שעדיין גלויים · הכנת המערכת לבדיקת החדירות (בעוד יומיים) · לפני מבחן החדירות: חסימת תקיפות, הגבלת קצב, security.txt",
 "wk1122_33": "דובדבן: גיבוי לילי מוצפן של מסד הנתונים · ניתוק אחרי שעתיים בלי שימוש (מקס' 12 שעות) וחסימת גישה מחוץ לישראל · סריקת אבטחה לפני מבדק Cybiz",
 "wk1122_34": "Punct: בדיקת הגדרות חברה וקטלוג חברה בכל החברות שעברו · מסך דרישה: שורת מוצר קורסת במעבר עכבר · גשר Priority: שליפת שורות הזמנה איטית (עד 6 שניות מתוך 8)",
 "wk1122_35": "Punct: רשימות דרישות והזמנות באתר לא נטענות (נועם) · איפוס סיסמה: אישור שהמייל נשלח + אפשרות לראות את הסיסמה · מסך חברות לאדמין: כל החברות הפעילות, ישנה או חדשה",
 "wk1122_36": "דובדבן: סריקה תוקפנית מלאה לפני מבדק Cybiz · ראשי מחלקות יכולים למחוק אירועים · הידוק כלל העיצוב (CSP) בלי unsafe-inline",
 "wk1122_37": "Punct: תיק חברה לצוות Punct + התאמת מק\"טים: אפיון · אפיון: אזור ניהול של כל חברה · פרטים: מסגרת אזור החברה והלשונית פרטים",
 "wk1122_38": "Punct: ספקים ותשלום: חלק התשלום · קטלוג: ייבוא מאקסל, חיפוש וסינון · ספקים: המשך – ברירת מחדל לחברה וסוכן לפי פרויקט",
 "wk1122_39": "Punct: פרויקטים: תקציב, מנהל פרויקט, קבלנים ומשאבים · סטרוקטורה: קבלת משלוח תיסגר בפריוריטי לסטטוס סופית · משתמשים: סוגי הרשאה, משתמש בכמה חברות, view as ומחיקה",
 "wk1122_40": "דובדבן: להסתיר \"בלי מידע על בוגרים\" כשלא רלוונטי · מחלקה חדשה: Friends of Duvdevan · אנגלית למשתמשי Friends of Duvdevan",
 "wk1122_41": "Punct: תהליכים וחיבורים: עטיפת זרימות, שלבי אישור, חיבור Priority ויומן · קטלוג חברה: רק מחיר חברה, בלי \"מחיר קטלוג\" · משתמשים: צפייה כמשתמש אחר (לצוות) והסתרה ממשתמש שהוסר",
 "wk1122_42": "Punct: \"ספקים\" בתפריט: מסך ספקים כללי, נפרד מניהול החברה · קטלוג ומק״טים: העלאה לפרודקשן · קטלוג גלי זיו: כל המק\"טים חסרים + עריכת התאמה קיימת",
 "wk1122_43": "דובדבן: שם חדש למערכת במסך הכניסה · הוספה מחדש של משתמש שנמחק (אורן לביא) · איה (עו\"ס) לא מצליחה לערוך את הגאנט של אירוע",
 "wk1122_44": "Punct: הרשאות לכל חברה: ברירת מחדל + התאמות · שרת Railway גם לפרודקשן · התראה כשמק״ט חדש או שינוי אושר מול Priority",
 "wk1122_45": "Punct: הרשאות: עיצוב חדש + הסתרת \"מנהל קטלוג\" · כרטיס מוצר אחד לצוות Punct: כל הפעולות על מוצר במקום אחד · בדיקת מק״טים מול Priority האמיתי של רום ובוארון",
 "wk1122_46": "Punct: משוב קצר למשתמשי המערכת הישנה של Punct (קישור + הודעה באפליקציה) · המערכת נופלת לשניות ומסכי הזמנות/דרישות לא נטענים (כרטיסים 599, 600) · באג #604: מק״ט של סוג מוצר בעמודת \"מזהה וריאנט\"",
 "wk1122_47": "דובדבן: הוספת מיקום חדש מתוך בחירת המיקום באירוע · אזכרה: אפשרות לקבוע ידנית / לפי לועזי · אפשרות 'ללא מלגאי' בפתיחת אירוע",
 "wk1122_48": "דובדבן: סוג אוכלוסייה חדש: צוותים ותיקים (סיימו מילואים) · תיק חלל: משפחה שכולה לפני חברי צוות + לשונית תקשורת · אפשרות 'מחלקת הנצחה - אירוע / מיזם משפחתי' בפתיחת אירוע",
 "wk1122_49": "דובדבן: טבלת הרשאות נפרדת לכל מחלקה · קישור אירועי הנצחה לחלל או לכל המשפחות השכולות · כרטיס אדם: צוות במקום אחד במקום 4 בלוקים",
 "wk1122_50": "Punct: באג #605: מודרייטור לא רואה מוצרים לא פעילים בקטלוג החברה · כרטיס מוצר: תיאור ב־2 שורות + השוואת מחירים ליחידה · באגים #601 ו־#602: כמות בקבלת משלוח + חיפוש פרויקט בהזמנה חדשה",
 "wk1122_51": "דובדבן: חוסן: סטטוס קשר נגזר מהשיחות ובלי 'שלב בתהליך' כפול · כרטיס אדם: השתתפות ברשימה אחת · אירוע: תכנית חובה, קטגוריה ושם נגזרים",
 "wk1122_52": "דובדבן: צוות חדש: שדות מובנים, שם אוטומטי ובדיקת כפילות · אירוע וייבוא: התראת כפילות ונרמול טלפונים · נוכחות ממקור אחד",
 "wk1122_53": "Punct: גלי-זיו: הדרישה מגיעה לפריוריטי עם המק״ט הכללי במקום מק״ט החברה · כרטיס מוצר לפרודקשן (כולל מחיר ליחידה ותיאור קצר) · מק״ט חברה מגיע לפריוריטי בכל החברות עם אינטגרציה",
 "wk1122_54": "דובדבן: תפריט: חוסן אחד עם טאבים ומסך סיכומים אחד · להפסיק לקרוא את 'שלב בתהליך' הכללי בכל המסכים · רשימת ניקוי נתונים לאישור (כפילויות ודוגמאות)",
 "wk1122_55": "דובדבן: רשימה אחת לסוג/קהל/אוכלוסיית יעד · דוחות: אותו מספר לכל מדד בכל המסכים · תיק צוות: חלק \"שירות סדיר\" וחלק \"שירות מילואים\"",
 "wk1122_56": "דובדבן: תיקון כפילויות לפי ביקורת המערכת (אקסל 25.11) · שירות סדיר בתיק צוות: היחידה תמיד 217 · איש קשר לחירום תחת חוסן",
 "wk1122_57": "Punct: לשונית ספקים בכרטיס מוצר: תמונת מצב של ההזמנות לכל סוג · הלילה: העתקת המחירים הקיימים להיסטוריית המחירים בפרודקשן · סטרוקטורה (מערכת ישנה): הזמנות מפריוריטי לא מופיעות בפונקט",
 "wk1122_58": "דובדבן: תאריך לידה: בלי תאריכים עתידיים, ובחירת שנה לא נסגרת · עיצוב דף צוות לפי העיצוב בהורדות · חוסן: הכרת משהב\"ט ואחוז נכות רק למי שיש תיק הכרה",
 "wk1122_59": "דובדבן: כרטיס אדם › חברי צוות: שיוך לצוות קיים · גישה למערכת גם מארה\"ב · באגים ובקשות: רשימה במקום כרטיסיות",
 "wk1122_60": "Punct: מק\"טי חברות: לימון ומק\"ט Punct לחברות בלי אינטגרציה · באתר הבדיקות לכתוב שזו סביבת בדיקות · כפילויות: להציע איחוד סוגים שההבדל ביניהם רק האריזה · ספקי בדיקה וקטגוריה \"string\": למחוק?",
 "wk1122_61": "דובדבן: אייקונים פשוטים ואחידים בכרטיסיות העליונות · באגים ובקשות: מה שמנהל מערכת מעלה מוסתר אוטומטית · סיכום חודשי לפי עו\"סית (אקסל)",
 "wk1122_62": "דובדבן: כספים: העיצוב חתוך בסוף · תפריט: \"הפקת אירועים\" לחוסן · לוח שנה ראשי: שם + מחזור + מספר מפגש",
 "wk1122_63": "דובדבן: עריכת אירוע: אי אפשר לערוך מיקום ופרטים נוספים · אירוע: \"ללא מלגאי\" בבחירת מלגאי · נופלי היחידה: בלי רשימת כל המשפחות השכולות לכל חלל",
 "wk1122_64": "דובדבן: נופלי היחידה: קישור אירוע קיים מהלוח · נופלי היחידה: בלי KPI, אזכרות קרובות למסך הבית של הנצחה · נופלי היחידה: עריכת תאריך אזכרה בעיפרון",
 "wk1122_65": "דובדבן: \"לזכר\" רק באירוע הנצחה · תיק צוות: מנחים ריקים לא מוצגים, צוות שכול מוסתר אם לא סומן · תיקי צוותים: החיפוש שבור",
 "wk1122_66": "Punct: עמוד \"באגים ובקשות\" בפונקט לצוות פונקט · באגים ובקשות: 4 הפריטים שהעלית בעמוד · באגים ובקשות: 4 פריטים על הקטלוג",
 "wk1122_67": "Punct: כרטיס מוצר › מק״ט חברות: כל חברה בשורה נפרדת · באגים ובקשות: \"הבקשות שלי\" ו\"בקשות שלי שטופלו\" · באגים ובקשות: כמה צילומי מסך לפריט",
 "wk1122_68": "Punct: השוואת מחירים: אקסל למוצר והיסטוריית מחירים · מיפוי מק״טים: חיפוש לפי מק״ט סוג, תיאורים מפריוריטי, פריהד · פרומט לקלוד בכרום: סריקת חוויית משתמש",
 "wk1122_69": "דובדבן: נתוני חוסן: לצמצם גלילה, פירוט לפי דרישה · בדיקת רגרסיה אחרי ~40 השינויים של 25.11 · כניסה עם Face ID / טביעת אצבע / PIN",
 "wk1122_70": "דובדבן: להעביר את האירוע \"פרסום מבט מקרוב פצועים\" לתכנית של חוסן · נתונים לסמדר: הפניות לטיפול, פסיכיאטר, ליווי להכרה · תיקי צוות: כולם רואים ועורכים, פרטים רגישים רק לעו\"סיות ולי",
 "wk1122_71": "Punct: יחידות מידה קוב/מ״ק, בועת AI זזה, חיפוש חברה · בקשה לפתיחת מק״ט חדש ממנהל הזמנות · מסכים לצוות Punct: ספק חדש, עדכון ספק ומשתמש חדש",
 "wk1122_72": "Punct: הערה גם באישור, במסך השאלות לנועם · תהליכי אישור שונים לפי חברה: מה צריך במערכת החדשה · מעבר לקוחות למערכת החדשה: חברה-חברה, אותה אפליקציה ואותו קישור",
 "wk1122_73": "Punct: עמוד באגים ובקשות: מחכות לתשובה ממני, דחוף, ופחות טקסטים · בוארון: השלמה אחרי ההפעלה לא רצה (5 דרישות חסרות) · מסך פתיחה מונפש לאפליקציה + לוגו וקטורי",
 "wk1122_74": "Punct: מדידת דיוק מנוע ה-AI כל ערב · בוארון (גלי זיו), מודרייטור מוגבל: כפתור אישור מיד אחרי \"שלח לאישור\" · לחבר את מנוע ה-AI לתשובות האימון + עוד שאלות",
 "wk1122_75": "Punct: מבנה מחירים חדש: שלב 0, בדיקה ומסמך · אפליקציה: \"אין הרשאה\" בקריאת הגדרות החברה · הגדרות חברה: בורר חברה כפול",
 "wk1122_76": "Punct: אדמינים חדשים לעובדי המשרד (רשימה של עמית) · צ'אט האפליקציה: \"היי אני צריכה להזמין מלט\" מציג מוצרים ומוסיף בלחיצה · תיקון ממצאי ה־UX Audit בהדרגה",
 "wk1122_77": "Punct: מסך דרישה: 9 פריטים מעמוד באגים ובקשות · חלונות דרישה חדשה והזמנה חדשה: 7 פריטים מעמוד באגים ובקשות · קטלוג: שמות אחידים, תיקון שמות הפוכים ומסך הוספת מוצר",
 "wk1122_78": "Punct: רישום שימוש בצ'אט (מי, מאיזו חברה, מתי, מה נשאל) · לחבר מפתח AI לצ'אט באתר החי · רשימות דרישות והזמנות: 15 פריטים מעמוד באגים ובקשות",
 "wk1122_79": "Punct: סטרוקטורה: סטטוס סופי בפריוריטי אחרי קבלת משלוח · חיפוש הזמנה או דרישה לפי הספרות האחרונות · צילום תעודת משלוח: זיהוי אוטומטי של מספר התעודה",
 "wk1122_80": "Punct: אזור החברה: \"כללי חברה\" נפתח בעמוד אחר ולא באותו פורמט · מסך דרישה והזמנה: כל עמודות שורת המוצר תמיד נראות · חברה שנפתחת במערכת החדשה מסומנת בטעות \"ישנה\"",
 "wk1122_81": "Punct: סוג משתמש חדש: צוות תמיכה טכנית · סרטון שיווקי: מהשטח לרכש ולספק · איפוס סיסמה עצמי לא עובד (ירדן מפריהד)",
 "wk1122_82": "Punct: שימוש בצ'אט: רק למעיין · איחוד שני חשבונות של אותו אדם · איפוס סיסמה ל־tarekabdul@gmail.com",
 "wk1122_83": "Punct: אפליקציה: \"הוספה להזמנה\" לא מוסיף את המוצר · כותרת טבלה קפואה בכל העמודים · באגים ובקשות: בחירת עמוד עם חיפוש בהקלדה",
 "wk1122_84": "Punct: מסך צוות Punct: כל המשתמשים במערכת + איפוס סיסמה + צפייה כמשתמש · ספק חדש: טלפון ומייל לא חובה · באגים ובקשות: שמירת פריט לוקחת הרבה זמן",
 "wk1122_85": "Punct: מוצרים בווב: כל העמודות בלי גלילה הצידה · כל האינטגרציות: כל תמונות תעודת המשלוח לנספחים בפריוריטי · מחיר והנחה בשורות הזמנה שסופקה / סופקה חלקית",
 "wk1122_86": "Punct: שם המוצר מפריוריטי נוסף אוטומטית כשם נרדף · חיפוש מוצרים חכם כמו בגוגל (גם עם שגיאות כתיב) · אפיון הוספת חברה חדשה מהמסך",
 "wk1122_87": "דובדבן: דף אירוע: בחירת נוכחים מתוך הצוות המחובר · דף אירוע: לבחור נוכחים מתוך הצוות · תיקי צוותים: כולם רואים, פרטים רגישים רק לעו\"ס ולמנהלת",
 "wk1122_88": "Punct: סרטון קצר לשטח של סטרוקטורה · בדיקה בדפדפן של שינויים שעלו בלי בדיקה במסך · העוזר החכם באתר לא מזהה מוצרים · אלישר: ישראל פרבר לא יכול לשלוח דרישה",
 "wk1122_89": "דובדבן: הרצת כל הבדיקות אחרי שינויי היום · תהליך הכרה: שלב \"הגיש החמרת מצב\" · אנשי קשר לחירום: למטה, אחד בברירת מחדל, הוספת עוד · מסגרת אינטנסיבית: לפרטים, לא לתיעוד שיחה",
 "wk1122_aroma": "סדנת ארומה תרפייה בתל אביב"
};
/** v1 project of each id: tells which calendar her Punct / Duvdevan / personal events used. */
const OLD_PROJECT: Record<string, string> = {"wk1122_0":"Punct","wk1122_1":"Punct","wk1122_2":"Punct","wk1122_3":"Punct","wk1122_4":"Punct","wk1122_5":"Duvdevan","wk1122_6":"Punct","wk1122_7":"Punct","wk1122_8":"Punct","wk1122_9":"Punct","wk1122_10":"Punct","wk1122_11":"Punct","wk1122_12":"Personal","wk1122_13":"Punct","wk1122_14":"Punct","wk1122_15":"Punct","wk1122_16":"Punct","wk1122_17":"Punct","wk1122_18":"Punct","wk1122_19":"Punct","wk1122_20":"Punct","wk1122_21":"Punct","wk1122_22":"Punct","wk1122_23":"Duvdevan","wk1122_24":"Punct","wk1122_25":"Duvdevan","wk1122_26":"Punct","wk1122_27":"Punct","wk1122_28":"Punct","wk1122_29":"Punct","wk1122_30":"Punct","wk1122_31":"Punct","wk1122_32":"Duvdevan","wk1122_33":"Duvdevan","wk1122_34":"Punct","wk1122_35":"Punct","wk1122_36":"Duvdevan","wk1122_37":"Punct","wk1122_38":"Punct","wk1122_39":"Punct","wk1122_40":"Duvdevan","wk1122_41":"Punct","wk1122_42":"Punct","wk1122_43":"Duvdevan","wk1122_44":"Punct","wk1122_45":"Punct","wk1122_46":"Punct","wk1122_47":"Duvdevan","wk1122_48":"Duvdevan","wk1122_49":"Duvdevan","wk1122_50":"Punct","wk1122_51":"Duvdevan","wk1122_52":"Duvdevan","wk1122_53":"Punct","wk1122_54":"Duvdevan","wk1122_55":"Duvdevan","wk1122_56":"Duvdevan","wk1122_57":"Punct","wk1122_58":"Duvdevan","wk1122_59":"Duvdevan","wk1122_60":"Punct","wk1122_61":"Duvdevan","wk1122_62":"Duvdevan","wk1122_63":"Duvdevan","wk1122_64":"Duvdevan","wk1122_65":"Duvdevan","wk1122_66":"Punct","wk1122_67":"Punct","wk1122_68":"Punct","wk1122_69":"Duvdevan","wk1122_70":"Duvdevan","wk1122_71":"Punct","wk1122_72":"Punct","wk1122_73":"Punct","wk1122_74":"Punct","wk1122_75":"Punct","wk1122_76":"Punct","wk1122_77":"Punct","wk1122_78":"Punct","wk1122_79":"Punct","wk1122_80":"Punct","wk1122_81":"Punct","wk1122_82":"Punct","wk1122_83":"Punct","wk1122_84":"Punct","wk1122_85":"Punct","wk1122_86":"Punct","wk1122_87":"Duvdevan","wk1122_88":"Punct","wk1122_89":"Duvdevan"};
/** [dayId, start, project, titles] for wk1122_0, wk1122_1, ... */
const BLOCKS: [string, string, string, string][] = [
 ["sun","08:00","Punct","Today's Punct tasks, mine and the team's · Fix bugs on the Punct task board"],
 ["sun","08:30","Punct","Fix punct-platform CI · Check AI engine accuracy against new answers"],
 ["sun","09:00","Punct","Samsung app: typed quantity saved as 1 in cart · Abbreviations dictionary for the AI engine"],
 ["sun","09:30","Punct","App header image cropped and blurry · Sort the product type list"],
 ["sun","10:00","Punct","Best-selling products report · Fix failing automated app tests"],
 ["sun","10:30","Punct","Moderator decides if buyers see the catalog · Merge catalog duplicates"],
 ["sun","11:00","Punct","Close the 14 open Punct board bugs · App: \"Send for approval\" fails"],
 ["sun","11:30","Punct","Parent and child products in the catalog"],
 ["sun","12:00","Duvdevan","Monthly summary for resilience fellows · Shared \"Bugs & requests\" page for all users"],
 ["sun","12:30","Duvdevan","Bugs & requests: pick the page from a list"],
 ["sun","13:00","Punct","App: \"New order\" fails and looks like the old one · Who can edit someone else's requisition"],
 ["sun","13:30","Punct","Site chat: \"I need to order cement\" shows products · Microphone in test-site catalog search"],
 ["sun","14:00","Punct","Microphone in the smart assistant · Merge child products button"],
 ["sun","14:30","Punct","Choice structure: no numbers, add and remove values · Logout button for Noam on the task site"],
 ["sun","15:00","Punct","Merge suggestions for the top 20 products · Assistant opens a requisition start to finish"],
 ["sun","15:30","Punct","Map parent product, choices and quantity (20 products) · Hide the microphone for now"],
 ["sun","16:00","Punct","Move Lupo to the new system tonight · Move Towers group (company 55) to the new system"],
 ["sun","16:30","Punct","Order assistant: step-by-step product type choice · Catalog screen and flow, starting with cement"],
 ["sun","17:00","Punct","Password 12345678 for all moved users · AI training: no \"who answers?\" screen on load"],
 ["sun","17:30","Personal","New requests board for all projects · Requests board moves to Vercel"],
 ["sun","18:00","Personal","Dock buttons open a new window · Claude night workers on the Mac"],
 ["sun","18:30","Personal","Reel for aunt's waffle and churros bar · Second reel: aunt's dessert bar"],
 ["sun","19:00","Personal","Salesforce connection on the Mac · New \"Espresso\" planner design"],
 ["sun","19:30","Punct","Bug #272: project name above supplier in orders · Reply to Noam: Lupo new, others old"],
 ["sun","20:00","Punct","Noam can't edit products in PR75341 (old system) · Punct team in the app: Lupo/Towers new, rest old"],
 ["sun","20:30","Punct","Check if Boaron and Rom Gevess ordered today · Bug #273: moderator can't see prices"],
 ["sun","21:00","Punct","Bug #275: can't pick a supplier in the app"],
 ["sun","21:30","Punct","Shared QA checklist for Lupo and Towers"],
 ["mon","08:00","Punct","PDF report for managers: move status · Lupo and Towers still on old system: block and move"],
 ["mon","08:30","Punct","Project filter: active only · Full end-to-end Punct code review"],
 ["mon","09:00","Punct","Kapayim: why delivery receipt failed (order 97062) · QA prompt to run after every company move"],
 ["mon","09:30","Punct","QA: split Lupo and Towers into two tabs · New requisition on web like the app"],
 ["mon","10:00","Punct","App: huge zoom on header background · Status update on the companies page"],
 ["mon","10:30","Punct","Limon: full money picture from Priority · Order email only to the supplier's set address"],
 ["mon","11:00","Punct","Move 8 Limon companies tonight · QA for the 8 Limon companies move"],
 ["mon","11:30","Punct","Move 8 more Limon companies · QA for the 8 more Limon companies"],
 ["mon","12:00","Punct","Order creator sees prices in API and app · Order creator can edit others' drafts"],
 ["mon","12:30","Punct","Saved prices missing in moved companies · App: Punct team sees one company only"],
 ["mon","13:00","Punct","Move Boaron (company 223) to the new system"],
 ["mon","13:30","Duvdevan","Several emergency contacts in graduate file · Schedule 6 workshops for all graduates in Gantt"],
 ["mon","14:00","Duvdevan","Screenshot in the bugs & requests form"],
 ["mon","14:30","Punct","Start the Rom Gevess move · Admin accounts for Noam and Amit"],
 ["mon","15:00","Punct","Boaron: requisitions reach Priority with generic SKU"],
 ["mon","15:30","Duvdevan","Private request on the bugs page · Fellows add weekly activity attendance"],
 ["mon","16:00","Duvdevan","Check if today's pen test got in"],
 ["mon","16:30","Punct","Amit can't log into Rom Gevess test user · Company settings didn't move from old system"],
 ["mon","17:00","Punct","App: switch between companies · Urgent bug #582: delivery date preset to the 29th"],
 ["mon","17:30","Punct","Bug #557: product note below the line · Bug #556: project name instead of supplier"],
 ["mon","18:00","Punct","Application error on site for Amit · Bug #555: red price when not fully priced"],
 ["mon","18:30","Punct","Bug #592: resend marked as order correction · Bug #591: ask before emailing the supplier"],
 ["mon","19:00","Punct","Bug #590: amount column missing for Amit · App: \"All companies\" for the Punct team"],
 ["mon","19:30","Punct","Test 54 failed: PDF with and without prices · Requisitions"],
 ["mon","20:00","Punct","New requisition · Catalog"],
 ["mon","20:30","Punct","Bug: user can't open a requisition"],
 ["mon","21:00","Punct","Rom Gevess: Priority sync skips 6 documents"],
 ["mon","21:30","Duvdevan","Encrypt all remaining sensitive fields"],
 ["tue","08:00","Duvdevan","Before pen test: blocking, rate limits, security.txt · Nightly encrypted database backup"],
 ["tue","08:30","Duvdevan","Idle logout after 2 hours, Israel-only access · Security scan before Cybiz audit"],
 ["tue","09:00","Punct","Check company settings and catalog in moved companies · Requisition screen: product row crashes on hover"],
 ["tue","09:30","Punct","Priority bridge: slow order line fetch · Requisition and order lists don't load (Noam)"],
 ["tue","10:00","Punct","Password reset: email confirmation and show password · Admin companies screen: all active companies"],
 ["tue","10:30","Duvdevan","Full aggressive scan before Cybiz audit · Department heads can delete events"],
 ["tue","11:00","Duvdevan","Tighten CSP without unsafe-inline"],
 ["tue","11:30","Punct","Company file and SKU matching: spec · Spec: management area for each company"],
 ["tue","12:00","Punct","Details: company area frame and details tab · Suppliers and payment: payment part"],
 ["tue","12:30","Punct","Catalog: Excel import, search and filter · Suppliers: company default and agent per project"],
 ["tue","13:00","Punct","Projects: budget, manager, contractors, resources · Structura: delivery closes Priority as final"],
 ["tue","13:30","Punct","Users: roles, multi-company, view as, delete"],
 ["tue","14:00","Duvdevan","Hide \"no graduate info\" when irrelevant · New department: Friends of Duvdevan"],
 ["tue","14:30","Duvdevan","English for Friends of Duvdevan users"],
 ["tue","15:00","Punct","Processes: flows, approval steps, Priority and calendar · Company catalog: company price only"],
 ["tue","15:30","Punct","Users: view as another user, hide removed user · \"Suppliers\" menu: general suppliers screen"],
 ["tue","16:00","Punct","Catalog and SKUs to production · Gali Ziv catalog: missing SKUs, edit mapping"],
 ["tue","16:30","Duvdevan","New system name on the login screen · Re-add a deleted user"],
 ["tue","17:00","Duvdevan","Aya can't edit an event's Gantt"],
 ["tue","17:30","Punct","Permissions per company: default and overrides · Railway server for production too"],
 ["tue","18:00","Punct","Alert when a new SKU is approved in Priority · Permissions: new design, hide \"catalog manager\""],
 ["tue","18:30","Punct","One product card for the Punct team · Check SKUs against Rom and Boaron's Priority"],
 ["tue","19:00","Punct","Short feedback for old-system users · System drops for seconds, lists don't load"],
 ["tue","19:30","Punct","Bug #604: product type SKU in variant column"],
 ["tue","20:00","Duvdevan","Add a new location from the event picker · Memorial: set date manually or by Gregorian"],
 ["tue","20:30","Duvdevan","\"No fellow\" option when opening an event · New population type: veteran teams"],
 ["tue","21:00","Duvdevan","Fallen soldier file: family first, media tab"],
 ["tue","21:30","Duvdevan","Separate permissions table per department"],
 ["wed","08:00","Duvdevan","Person card: team in one place"],
 ["wed","08:30","Punct","Bug #605: moderator can't see inactive products · Product card: 2-line description, unit price compare"],
 ["wed","09:00","Punct","Bugs #601, #602: delivery qty, project search"],
 ["wed","09:30","Duvdevan","Resilience: contact status from calls · Person card: participation in one list"],
 ["wed","10:00","Duvdevan","Event: required programme, derived category and name · New team: structured fields, auto name, dup check"],
 ["wed","10:30","Duvdevan","Event and import: dup alert, phone cleanup · Attendance from one source"],
 ["wed","11:00","Punct","Gali Ziv: requisition reaches Priority with generic SKU · Product card to production"],
 ["wed","11:30","Punct","Company SKU reaches Priority in all integrations"],
 ["wed","12:00","Duvdevan","Menu: one Resilience item with tabs · Stop reading the general process stage"],
 ["wed","12:30","Duvdevan","Data cleanup list for approval · One list for type, audience and target group"],
 ["wed","13:00","Duvdevan","Reports: same number for each metric everywhere · Team file: regular and reserve service"],
 ["wed","13:30","Duvdevan","Fix duplicates from the system audit · Regular service in team file: unit always 217"],
 ["wed","14:00","Duvdevan","Emergency contact under Resilience"],
 ["wed","14:30","Punct","Product card suppliers tab: order snapshot · Tonight: copy prices into price history"],
 ["wed","15:00","Punct","Structura (old system): Priority orders missing"],
 ["wed","15:30","Duvdevan","Birth date: no future dates, year picker fix · Team page design from the mockup"],
 ["wed","16:00","Duvdevan","Resilience: MoD recognition only with a file · Person card team members: link to existing team"],
 ["wed","16:30","Duvdevan","System access from the US too · Bugs & requests: list instead of cards"],
 ["wed","17:00","Punct","Company SKUs: Limon and Punct SKU without integration · Mark the test site as a test environment"],
 ["wed","17:30","Punct","Duplicates: merge types that differ only by packaging · Test suppliers and \"string\" category: delete?"],
 ["wed","18:00","Duvdevan","Simple matching icons in the top tabs · Bugs & requests: admin items hidden"],
 ["wed","18:30","Duvdevan","Monthly summary per social worker (Excel) · Finance: layout cut off at the end"],
 ["wed","19:00","Duvdevan","Menu: \"Event production\" for Resilience · Main calendar: name, cycle and session number"],
 ["wed","19:30","Duvdevan","Edit event: location and details not editable · Event: \"No fellow\" in fellow picker"],
 ["wed","20:00","Duvdevan","Fallen: no full bereaved family list · Fallen: link an existing event"],
 ["wed","20:30","Duvdevan","Fallen: no KPIs, upcoming memorials on home"],
 ["wed","21:00","Duvdevan","\"In memory of\" only on memorial events"],
 ["wed","21:30","Duvdevan","Team files: search is broken"],
 ["thu","08:00","Punct","Punct \"Bugs & requests\" page for the team · Bugs & requests: your 4 items"],
 ["thu","08:30","Punct","Bugs & requests: 4 catalog items · Product card company SKUs: one row per company"],
 ["thu","09:00","Punct","Bugs & requests: \"My requests\" and \"My handled\" · Bugs & requests: several screenshots per item"],
 ["thu","09:30","Punct","Price comparison: Excel and price history · SKU mapping: type SKU search, Priority descriptions"],
 ["thu","10:00","Punct","Prompt for Claude in Chrome: UX scan"],
 ["thu","10:30","Duvdevan","Resilience data: less scrolling, per-request detail · Regression test after 25.11 changes"],
 ["thu","11:00","Duvdevan","Sign in with Face ID, fingerprint or PIN · Move wounded close-up event to Resilience"],
 ["thu","11:30","Duvdevan","Data for Smadar: therapy and recognition referrals · Team files: all can edit, sensitive for social workers"],
 ["thu","12:00","Punct","Units m³, moving AI bubble, company search · New SKU request from order manager"],
 ["thu","12:30","Punct","Punct team screens: suppliers and users · Note on approval too, in Noam's questions"],
 ["thu","13:00","Punct","Approval flows per company: what's needed · Customer move: company by company, same app"],
 ["thu","13:30","Punct","Bugs page: waiting on me, urgent, less text · Boaron: post-launch backfill didn't run"],
 ["thu","14:00","Punct","Animated app splash screen and vector logo · Measure AI engine accuracy every night"],
 ["thu","14:30","Punct","Boaron restricted moderator: approve right after sending · Connect AI engine to training answers"],
 ["thu","15:00","Punct","New pricing structure: stage 0 · App: \"Forbidden\" reading company settings"],
 ["thu","15:30","Punct","Company settings: double company picker · New admins for office staff"],
 ["thu","16:00","Punct","App chat: \"I need to order cement\" shows products · Fix UX audit findings step by step"],
 ["thu","16:30","Punct","Requisition screen: 9 items from bugs page · New requisition and order windows: 7 items"],
 ["thu","17:00","Punct","Catalog: consistent names, add product screen · Log chat usage"],
 ["thu","17:30","Punct","Connect AI key to the live site chat"],
 ["thu","18:00","Punct","Structura: final Priority status after delivery"],
 ["thu","18:30","Punct","Delivery note photo: auto-read the number"],
 ["thu","21:00","Punct","Requisition and order: all product columns visible"],
 ["thu","21:30","Punct","New user type: tech support team"],
 ["fri","08:00","Punct","Marketing video: from site to purchasing and supplier"],
 ["fri","08:30","Punct","Self password reset not working"],
 ["fri","09:00","Punct","Chat usage: Maayan only"],
 ["fri","09:30","Punct","Merge two accounts of one person"],
 ["fri","10:00","Punct","Password reset for a user"],
 ["fri","10:30","Punct","App: \"Add to order\" doesn't add the product"],
 ["fri","11:00","Punct","Frozen table header on every page"],
 ["fri","11:30","Punct","Bugs & requests: type-to-search page picker"],
 ["fri","12:00","Punct","Punct team screen: all users, reset, view as"],
 ["fri","12:30","Punct","New supplier: phone and email optional"],
 ["fri","13:00","Punct","Bugs & requests: saving an item is slow"],
 ["fri","13:30","Punct","Web products: all columns without side scroll"],
 ["fri","14:00","Punct","All integrations: delivery photos to Priority"],
 ["fri","14:30","Punct","Price and discount on delivered order lines"],
 ["fri","15:00","Punct","Priority product name auto-added as synonym"],
 ["fri","15:30","Punct","Smart product search that forgives typos"],
 ["fri","16:00","Punct","Spec: add a new company from the screen"],
 ["fri","16:30","Duvdevan","Event page: pick attendees from linked team"],
 ["fri","17:00","Duvdevan","Event page: choose attendees from the team"],
 ["fri","17:30","Duvdevan","Team files: sensitive details for social worker only"],
 ["fri","18:00","Punct","Short field video for Structura"],
 ["fri","18:30","Punct","Browser check of untested live changes"],
 ["fri","19:00","Punct","Site assistant doesn't recognize products"],
 ["fri","19:30","Punct","Elishar: user can't send a requisition"],
 ["fri","20:00","Duvdevan","Run all tests after today's changes"],
 ["fri","20:30","Duvdevan","Recognition process: \"worsening filed\" stage"],
 ["fri","21:00","Duvdevan","Emergency contacts: bottom, one default, add more"],
 ["fri","21:30","Duvdevan","Intensive setting: details, not a call log"],
 ["sun","22:00","Punct","New app look only for moved companies"],
 ["sun","22:30","Punct","Connect the new system to Limon's Priority"],
 ["mon","22:00","Punct","Boaron hit the integration call limit"],
 ["mon","22:30","Duvdevan","Prepare the system for the pen test"],
 ["tue","22:00","Duvdevan","Memorial event / family project option"],
 ["tue","22:30","Duvdevan","Link memorial events to a fallen soldier or all families"],
 ["wed","22:00","Duvdevan","Fallen: edit memorial date with pencil"],
 ["wed","22:30","Duvdevan","Team file: hide empty mentors and bereaved team"],
 ["thu","22:00","Punct","Company area: \"Company rules\" opens elsewhere"],
 ["thu","22:30","Punct","New-system company wrongly marked \"old\""],
 ["fri","22:00","Punct","Requisition and order lists: 15 items"],
 ["fri","22:30","Punct","Find order or requisition by last digits"],
];

function weekStartDate(): Date {
  const [y, m, d] = WEEK.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function importWeekTasks(): void {
  try {
    if (localStorage.getItem(FLAG)) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { tasksByWeek: {}, goalsByWeek: {}, libraryTasks: [] };
    data.tasksByWeek ??= {};
    const week: Task[] = data.tasksByWeek[WEEK] ?? [];
    const synced = loadSyncedEvents();

    // Which calendar each project's v1 blocks went to, so the new blocks land there too.
    const calByProject: Record<string, string> = {};
    let aromaCal: string | undefined;
    for (const t of week) {
      if (!t.id.startsWith(WEEK_IMPORT_ID_PREFIX)) continue;
      const cal = synced[t.id]?.calendarId ?? t.calendarId;
      if (!cal) continue;
      if (t.id === AROMA_ID) aromaCal = cal;
      const p = OLD_PROJECT[t.id];
      if (p && !calByProject[p]) calByProject[p] = cal;
    }

    const others = week.filter(t => !t.id.startsWith(WEEK_IMPORT_ID_PREFIX));
    let order = others.length;
    const blocks: Task[] = BLOCKS.map(([dayId, startTime, project, titles], i) => ({
      id: `${WEEK_IMPORT_ID_PREFIX}${i}`,
      content: `${project} // ${titles}`,
      status: 'green',
      color: 'none',
      dayId,
      isDaily: false,
      sortOrder: order++,
      startTime,
      durationMinutes: 30,
      ...(calByProject[project] ? { calendarId: calByProject[project] } : {}),
    }));
    blocks.push({
      id: AROMA_ID, content: AROMA_TITLE, status: 'none', color: 'none', dayId: 'thu',
      isDaily: false, sortOrder: order++, startTime: '19:00', durationMinutes: 120,
      ...(aromaCal ? { calendarId: aromaCal } : {}),
    });
    data.tasksByWeek[WEEK] = [...others, ...blocks];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(FLAG_V1, '1');
    localStorage.setItem(FLAG, '1');
    localStorage.setItem(RESYNC_FLAG, '1');
  } catch { /* ignore */ }
}

/** True until the Google side of the v2 import has been brought up to date. */
export function weekImportResyncPending(): boolean {
  try { return !!localStorage.getItem(RESYNC_FLAG); } catch { return false; }
}

const isGone = (err: unknown) => /not found|has been deleted|API error (404|410)/i.test(String((err as Error)?.message ?? err));

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/** Brings Google Calendar in line with the v2 blocks. The planner's own sync only creates
 * missing events and never pushes a title/time change made outside its handlers, so:
 * 1. every block already mapped to an event gets that event PATCHed (English title, new
 *    time, and moved to the block's calendar if it changed project);
 * 2. any event in that week still carrying a v1 Hebrew title and not mapped here (e.g.
 *    made from another browser) is deleted;
 * 3. a block with no event adopts an existing event with the same title and start (made
 *    by another browser) instead of creating a duplicate.
 * Blocks left without an event are then created by the planner's normal backfill.
 * Returns a calendar for blocks that had none (from the project prefix only, since words
 * in an English title like "home" or "run" would match other calendars' keywords). */
export async function resyncWeekImport(calendars: GCalCalendar[], learned: Record<string, string>): Promise<Record<string, string>> {
  const calendarFor: Record<string, string> = {};
  if (!weekImportResyncPending()) return calendarFor;
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  const tasks: Task[] = (data.tasksByWeek?.[WEEK] ?? []).filter((t: Task) => t.id.startsWith(WEEK_IMPORT_ID_PREFIX) && t.startTime);
  const ws = weekStartDate();
  const startOf = (t: Task) => formatLocalDateTime(ws, DAY_IDS.indexOf(t.dayId), t.startTime!);
  const calName = (id: string) => calendars.find(c => c.id === id)?.summary ?? '';
  const synced: Record<string, SyncedEventInfo> = loadSyncedEvents();
  for (const t of tasks) {
    if (t.calendarId || t.id === AROMA_ID) continue;
    const cal = resolveLearnedOrRuleMatch(t.content.split(' // ')[0], calendars, learned);
    if (cal) calendarFor[t.id] = cal.id;
  }
  let failed = false;

  // 1. Update the events v1 already created.
  await inBatches(tasks.filter(t => synced[t.id]), 4, async t => {
    const info = synced[t.id];
    try {
      const res = await updateCalendarEvent(info.calendarId, info.eventId, startOf(t), t.durationMinutes ?? 30, t.content) as { status?: string };
      if (res?.status === 'cancelled') { delete synced[t.id]; return; } // deleted in Google: recreate
      let calendarId = info.calendarId;
      const want = t.calendarId ?? calendarFor[t.id];
      if (want && want !== calendarId && calendars.some(c => c.id === want)) {
        try { await moveCalendarEvent(calendarId, info.eventId, want); calendarId = want; }
        catch (err) { console.warn('[weekImport] move failed, event kept on its calendar', t.id, err); }
      }
      synced[t.id] = { ...info, calendarId, calendarName: calName(calendarId) || info.calendarName, syncedAt: new Date().toISOString() };
    } catch (err) {
      if (isGone(err)) delete synced[t.id];
      else { failed = true; console.warn('[weekImport] update failed', t.id, err); }
    }
  });
  saveAllSyncedEvents(synced);

  // 2 + 3. Clean up and adopt, from what is really in Google that week.
  try {
    const end = new Date(ws); end.setDate(end.getDate() + 7);
    const events: GCalBusyEvent[] = await fetchWeekEvents(ws.toISOString(), end.toISOString(), { translate: false });
    const mapped = new Set(Object.values(synced).map(i => i.eventId));
    const oldTitles = new Set(Object.values(OLD_TITLES));
    await inBatches(events.filter(ev => oldTitles.has(ev.title) && !mapped.has(ev.id)), 4, async ev => {
      try { await deleteCalendarEvent(ev.calendarId, ev.id); }
      catch (err) { failed = true; console.warn('[weekImport] delete failed', ev.id, err); }
    });
    const key = (title: string, start: string) => `${title}|${new Date(start).getTime()}`;
    const free = new Map<string, GCalBusyEvent>();
    for (const ev of events) if (!mapped.has(ev.id) && !oldTitles.has(ev.title)) free.set(key(ev.title, ev.start), ev);
    for (const t of tasks) {
      if (synced[t.id]) continue;
      const ev = free.get(key(t.content, startOf(t)));
      if (!ev) continue;
      free.delete(key(t.content, startOf(t)));
      synced[t.id] = { eventId: ev.id, calendarId: ev.calendarId, calendarName: ev.calendarName, htmlLink: '', syncedAt: new Date().toISOString() };
    }
    saveAllSyncedEvents(synced);
  } catch (err) {
    failed = true;
    console.warn('[weekImport] cleanup failed', err);
  }

  // Retry next time the app opens if something failed, but not forever.
  const tries = Number(localStorage.getItem(`${RESYNC_FLAG}-tries`) ?? '0') + 1;
  localStorage.setItem(`${RESYNC_FLAG}-tries`, String(tries));
  if (!failed || tries >= 3) localStorage.removeItem(RESYNC_FLAG);
  return calendarFor;
}
