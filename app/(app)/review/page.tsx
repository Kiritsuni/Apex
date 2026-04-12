'use client';

import { useState, useRef, useCallback } from 'react';
import { format, startOfISOWeek, endOfISOWeek, subWeeks } from 'date-fns';
import { Sparkles, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessions } from '@/hooks/useSessions';
import { useActivities } from '@/hooks/useActivities';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Render a line that may contain **bold** spans */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-semibold text-[var(--text-primary)]">{part}</strong>
          : part,
      )}
    </>
  );
}

/** Minimal markdown → JSX: bold headers, bullets, numbered lists, paragraphs */
function ReviewText({ text }: { text: string }) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === '') {
      nodes.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // **Header** — whole line is bold
    const headerMatch = trimmed.match(/^\*\*(.+?)\*\*[:\s]*$/);
    if (headerMatch) {
      nodes.push(
        <p key={i} className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mt-4 first:mt-0">
          {headerMatch[1]}
        </p>,
      );
      continue;
    }

    // - bullet
    if (/^[-•]\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-•]\s+/, '');
      nodes.push(
        <div key={i} className="flex items-start gap-2">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
          <span className="text-sm text-[var(--text-secondary)] leading-relaxed">{renderInline(content)}</span>
        </div>,
      );
      continue;
    }

    // 1. numbered
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      nodes.push(
        <div key={i} className="flex items-start gap-2">
          <span className="text-xs font-bold text-[var(--accent)] shrink-0 w-4 text-right mt-0.5">{numMatch[1]}.</span>
          <span className="text-sm text-[var(--text-secondary)] leading-relaxed">{renderInline(numMatch[2])}</span>
        </div>,
      );
      continue;
    }

    // plain paragraph
    nodes.push(
      <p key={i} className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {renderInline(trimmed)}
      </p>,
    );
  }

  return <div className="space-y-1">{nodes}</div>;
}

export default function ReviewPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [review, setReview] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const referenceDate = weekOffset > 0 ? subWeeks(new Date(), weekOffset) : new Date();
  const weekStart = startOfISOWeek(referenceDate);
  const weekEnd = endOfISOWeek(referenceDate);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const isCurrentWeek = weekOffset === 0;

  const { sessions, loading: sessionsLoading } = useSessions({ from: weekStartStr, to: weekEndStr });
  const { activities, loading: activitiesLoading } = useActivities();
  const isLoading = sessionsLoading || activitiesLoading;

  const statsByActivity: Record<string, {
    name: string; color: string; totalSeconds: number; sessions: number; goalHours?: number;
  }> = {};
  for (const s of sessions) {
    if (!statsByActivity[s.activity_id]) {
      const a = activities.find((act) => act.id === s.activity_id);
      statsByActivity[s.activity_id] = {
        name: s.activity?.name ?? a?.name ?? 'Unknown',
        color: s.activity?.color ?? a?.color ?? '#888',
        totalSeconds: 0,
        sessions: 0,
        goalHours: a?.weekly_goal_hours,
      };
    }
    statsByActivity[s.activity_id].totalSeconds += s.duration_seconds ?? 0;
    statsByActivity[s.activity_id].sessions += 1;
  }

  const weekTotal = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
  const sortedStats = Object.values(statsByActivity).sort((a, b) => b.totalSeconds - a.totalSeconds);

  const generateReview = useCallback(async () => {
    setGenerating(true);
    setReview('');
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekOffset }),
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setReview(text);
      }
    } finally {
      setGenerating(false);
    }
  }, [weekOffset]);

  const exportPDF = useCallback(async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jsPDFModule;

      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;

      let y = 10;
      if (imgH > pageH - 20) {
        let srcY = 0;
        const rowH = (pageH - 20) * (canvas.width / imgW);
        while (srcY < canvas.height) {
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.min(rowH, canvas.height - srcY);
          const ctx = pageCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, -srcY);
          const pageImg = pageCanvas.toDataURL('image/png');
          if (srcY > 0) { pdf.addPage(); y = 10; }
          pdf.addImage(pageImg, 'PNG', 10, y, imgW, (pageCanvas.height * imgW) / canvas.width);
          srcY += rowH;
        }
      } else {
        pdf.addImage(imgData, 'PNG', 10, y, imgW, imgH);
      }

      pdf.save(`APEX_Review_${weekStartStr}_${weekEndStr}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  }, [weekStartStr, weekEndStr]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-fade-in">
      {/* Header + week nav */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Weekly Review</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
            {isCurrentWeek && <span className="ml-2 text-[var(--accent)]">· This week</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setWeekOffset((o) => o + 1); setReview(''); }}
            className="p-2 rounded-[6px] hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setWeekOffset((o) => Math.max(0, o - 1)); setReview(''); }}
            disabled={isCurrentWeek}
            className="p-2 rounded-[6px] hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors disabled:opacity-40"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Exportable section */}
      <div ref={exportRef} className="space-y-4">
        {/* Stats card */}
        <Card className="p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              {[1, 2, 3].map((n) => (
                <div key={n} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-1 w-full ml-4" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                  Total:{' '}
                  <span className="text-[var(--text-primary)]">{formatDuration(weekTotal)}</span>
                </p>
                <p className="text-xs text-[var(--text-muted)]">{sessions.length} sessions</p>
              </div>

              {sortedStats.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No sessions this week</p>
              ) : (
                <div className="space-y-2">
                  {sortedStats.map((stat) => {
                    const pct = stat.goalHours
                      ? Math.min(stat.totalSeconds / (stat.goalHours * 3600), 1)
                      : null;
                    return (
                      <div key={stat.name} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: stat.color }}
                          />
                          <span className="text-xs text-[var(--text-secondary)] flex-1 truncate">
                            {stat.name}
                          </span>
                          <span className="text-xs font-medium text-[var(--text-primary)]">
                            {formatDuration(stat.totalSeconds)}
                          </span>
                          {pct !== null && (
                            <span
                              className="text-xs w-10 text-right tabular-nums"
                              style={{ color: pct >= 1 ? 'var(--success)' : stat.color }}
                            >
                              {Math.round(pct * 100)}%
                            </span>
                          )}
                        </div>
                        {pct !== null && (
                          <div className="w-full h-1 bg-[var(--surface-2)] rounded-full overflow-hidden ml-4">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.round(pct * 100)}%`,
                                backgroundColor: stat.color,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>

        {/* AI review */}
        {(review || generating) && (
          <Card className="p-4">
            {generating && !review ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : (
              <ReviewText text={review} />
            )}
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={generateReview}
          disabled={generating || isLoading}
          className="flex-1 gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {generating ? 'Generating…' : review ? 'Regenerate' : 'Generate AI Review'}
        </Button>

        {(sessions.length > 0 || review) && (
          <Button
            variant="secondary"
            onClick={exportPDF}
            disabled={exporting}
            className="gap-2 shrink-0"
            title="Export as PDF"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'PDF'}
          </Button>
        )}
      </div>
    </div>
  );
}
