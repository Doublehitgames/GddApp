"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  taskCountByDate: Record<string, { total: number; done: number }>;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function WeekStrip({
  weekStart,
  onPrev,
  onNext,
  selectedDate,
  onSelectDate,
  taskCountByDate,
}: Props) {
  const { t, locale } = useI18n();
  const DAY_LABELS = [
    t("agenda.days.sun"),
    t("agenda.days.mon"),
    t("agenda.days.tue"),
    t("agenda.days.wed"),
    t("agenda.days.thu"),
    t("agenda.days.fri"),
    t("agenda.days.sat"),
  ];
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const todayStr = toISODate(new Date());
  // Disable "next week" if today falls within the current displayed week
  const isCurrentOrFutureWeek = useMemo(() => {
    const firstDay = toISODate(days[0]);
    const lastDay = toISODate(days[6]);
    return todayStr >= firstDay && todayStr <= lastDay;
  }, [days, todayStr]);

  const monthLabel = useMemo(() => {
    const start = days[0];
    const end = days[6];
    const startMonth = start.toLocaleDateString(locale, { month: "short" });
    const endMonth = end.toLocaleDateString(locale, { month: "short" });
    const year = end.getFullYear();
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} de ${startMonth} ${year}`;
    }
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${year}`;
  }, [days]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-700 text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
          aria-label={t("agenda.prevWeek")}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm font-medium text-gray-300 tabular-nums">{monthLabel}</span>

        <button
          type="button"
          onClick={onNext}
          disabled={isCurrentOrFutureWeek}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-700 text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t("agenda.nextWeek")}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day buttons */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const iso = toISODate(day);
          const isToday = iso === todayStr;
          const isFuture = iso > todayStr;
          const isSelected = iso === selectedDate;
          const counts = taskCountByDate[iso];
          const hasTasks = counts && counts.total > 0;
          const allDone = hasTasks && counts.done === counts.total;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => !isFuture && onSelectDate(iso)}
              disabled={isFuture}
              className={`group flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                isFuture
                  ? "border-gray-800/40 bg-gray-900/20 cursor-not-allowed opacity-30"
                  :
                isSelected
                  ? "border-sky-400 bg-sky-500/15 shadow-sm shadow-sky-900/30"
                  : isToday
                  ? "border-sky-700/50 bg-sky-950/40 hover:border-sky-600 hover:bg-sky-900/30"
                  : "border-gray-700/60 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-800/50"
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-widest ${
                  isSelected ? "text-sky-300" : isToday ? "text-sky-400" : "text-gray-500"
                }`}
              >
                {DAY_LABELS[day.getDay()]}
              </span>

              <span
                className={`text-base font-bold tabular-nums leading-none ${
                  isSelected ? "text-white" : isToday ? "text-sky-200" : "text-gray-300"
                }`}
              >
                {day.getDate()}
              </span>

              {/* Task progress dots */}
              <div className="flex h-2 items-center gap-0.5">
                {hasTasks ? (
                  allDone ? (
                    <span className="flex h-2 w-2 items-center justify-center">
                      <svg className="h-2 w-2 text-emerald-400" viewBox="0 0 8 8" fill="currentColor">
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                    </span>
                  ) : (
                    Array.from({ length: Math.min(counts.total, 5) }, (_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${
                          i < counts.done
                            ? "bg-emerald-400"
                            : isSelected
                            ? "bg-sky-400/60"
                            : "bg-gray-600"
                        }`}
                      />
                    ))
                  )
                ) : (
                  <span className="h-1.5 w-1.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
