import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { connectCloud, getCloudStatus, isCloudOn, onCloudStatus, syncNow, type CloudStatus } from '@/services/cloudSync';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

/** Header button for cloud storage (R-199): turn it on once per device, then shows whether everything is saved. */
export function CloudSyncButton() {
  const [status, setStatus] = useState<CloudStatus>(getCloudStatus);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => onCloudStatus(setStatus), []);

  const turnOn = async () => {
    setConnecting(true);
    try {
      await connectCloud();
      // Fresh Google tokens + possibly data pulled from another device: reload so every screen shows it.
      window.location.reload();
    } catch (err: any) {
      alert(`השמירה בענן לא הופעלה: ${err?.message ?? err}`);
    } finally {
      setConnecting(false);
    }
  };

  if (!isCloudOn() || status.state === 'off') {
    return (
      <button
        onClick={turnOn}
        disabled={connecting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 dark:text-sky-300 dark:bg-sky-950/30 rounded-xl transition-base disabled:opacity-60"
        title="לשמור את כל המשימות בחשבון Google שלך, כדי שיופיעו בכל מכשיר ולא יימחקו בניקוי הדפדפן"
      >
        {connecting ? <Loader2 size={14} className="animate-spin" /> : <CloudOff size={14} />}
        <span>שמירה בענן</span>
      </button>
    );
  }

  if (status.state === 'error') {
    return (
      <button
        onClick={() => (/הרשאה/.test(status.message) ? turnOn() : void syncNow())}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-destructive bg-[hsl(var(--status-red-bg))] rounded-xl transition-base"
        title={`${status.message}\nלחיצה: לנסות שוב`}
      >
        <AlertTriangle size={14} />
        <span>לא נשמר בענן</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => void syncNow()}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[hsl(var(--status-green))] bg-[hsl(var(--status-green-bg))] rounded-xl transition-base"
      title={status.state === 'ok' ? `נשמר בענן ב־${timeLabel(status.at)}. לחיצה: לסנכרן עכשיו` : 'שומר בענן…'}
    >
      {status.state === 'syncing' ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
      <span>{status.state === 'syncing' ? 'שומר…' : 'נשמר בענן'}</span>
    </button>
  );
}
