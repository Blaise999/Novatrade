// Admin Types for Trade Signal System

export type AdminRole = 'super_admin' | 'admin' | 'signal_provider';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  telegramHandle?: string;
  createdAt: Date;
  lastLogin?: Date;
}

export interface TradeSignal {
  id: string;
  assetId: string;
  assetSymbol: string;
  assetName: string;
  direction: 'up' | 'down';
  startTime: Date;
  endTime: Date;
  duration: number; // in seconds (e.g., 300 for 5 min)
  status: 'scheduled' | 'active' | 'completed';
  createdBy: string;
  createdAt: Date;
  notes?: string; // Admin notes for teaching
}

export interface TradingSession {
  id: string;
  name: string; // e.g., "Morning Session", "EUR/USD Power Hour"
  assetId: string;
  assetSymbol: string;
  startTime: Date;
  endTime: Date;
  signals: TradeSignal[];
  status: 'draft' | 'scheduled' | 'active' | 'completed';
  createdBy: string;
  createdAt: Date;
  telegramMessage?: string; // Pre-formatted message for TG
}

export interface SessionTemplate {
  id: string;
  name: string;
  assetId: string;
  assetSymbol: string;
  durationMinutes: number; // Total session duration
  tradeDurationSeconds: number; // Each trade duration (e.g., 300 for 5 min)
  defaultSignals: Array<{
    minuteOffset: number; // Minutes from session start
    direction: 'up' | 'down';
  }>;
}

export interface AdminStats {
  totalSessions: number;
  totalSignals: number;
  activeSession: TradingSession | null;
  upcomingSessions: TradingSession[];
  completedToday: number;
}

// Helper to generate time slots
export function generateTimeSlots(
  startTime: Date,
  endTime: Date,
  tradeDurationSeconds: number
): Array<{ start: Date; end: Date; index: number }> {
  const slots: Array<{ start: Date; end: Date; index: number }> = [];
  let current = new Date(startTime);
  let index = 0;

  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + tradeDurationSeconds * 1000);
    if (slotEnd <= endTime) {
      slots.push({
        start: new Date(current),
        end: slotEnd,
        index,
      });
    }
    current = slotEnd;
    index++;
  }

  return slots;
}

// Format time for display
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Format for Telegram message
export function generateTelegramMessage(session: TradingSession): string {
  const lines: string[] = [
    `🚀 *${session.name}*`,
    `📊 Asset: ${session.assetSymbol}`,
    `⏰ Time: ${formatTime(session.startTime)} - ${formatTime(session.endTime)}`,
    ``,
    `📋 *Trade Signals:*`,
    ``,
  ];

  session.signals.forEach((signal, index) => {
    const emoji = signal.direction === 'up' ? '🟢 UP' : '🔴 DOWN';
    const time = formatTime(signal.startTime);
    lines.push(`${index + 1}. ${time} → ${emoji}`);
  });

  lines.push(``);
  lines.push(`💡 *Tips:*`);
  lines.push(`• Enter trade at exact time`);
  lines.push(`• Use 5-minute duration`);
  lines.push(`• Risk only 2-5% per trade`);
  lines.push(``);
  lines.push(`✅ Follow signals exactly for best results!`);

  return lines.join('\n');
}
