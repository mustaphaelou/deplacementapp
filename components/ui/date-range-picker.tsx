"use client"

import { format, differenceInCalendarDays } from "date-fns"
import { fr } from "date-fns/locale"
import { DayPicker } from "react-day-picker"
import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  dateDepart: string
  dateRetour: string
  onDateDepartChange: (value: string) => void
  onDateRetourChange: (value: string) => void
  errorDepart?: string
  errorRetour?: string
}

function toDate(s: string): Date | undefined {
  if (!s) return undefined
  const d = new Date(s + "T00:00:00")
  return isNaN(d.getTime()) ? undefined : d
}

function toString(d: Date | undefined): string {
  if (!d) return ""
  return format(d, "yyyy-MM-dd")
}

const classNames = {
  root: "w-full",
  months: "flex flex-wrap gap-2 justify-center",
  month: "w-full",
  month_caption:
    "flex items-center justify-center py-1 font-semibold text-sm",
  caption_label: "px-1",
  nav: "flex items-center gap-1",
  button_previous:
    "inline-flex items-center justify-center size-7 border border-border rounded-[min(var(--radius-md),10px)] bg-transparent cursor-pointer text-muted-foreground hover:bg-muted transition-colors",
  button_next:
    "inline-flex items-center justify-center size-7 border border-border rounded-[min(var(--radius-md),10px)] bg-transparent cursor-pointer text-muted-foreground hover:bg-muted transition-colors",
  chevron: "size-4",
  month_grid: "w-full",
  weekdays: "flex",
  weekday: "flex-1 text-center text-xs font-semibold text-muted-foreground py-1.5",
  week: "flex",
  day: "flex-1 text-center p-px",
  day_button:
    "size-8 border-none rounded-md bg-transparent cursor-pointer text-sm inline-flex items-center justify-center transition-colors hover:bg-muted",
  today: "font-bold border border-border rounded-md",
  selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md",
  disabled: "opacity-35 cursor-not-allowed hover:bg-transparent",
  outside: "opacity-30 pointer-events-none",
}

export function DateRangePicker({
  dateDepart,
  dateRetour,
  onDateDepartChange,
  onDateRetourChange,
  errorDepart,
  errorRetour,
}: DateRangePickerProps) {
  const depart = toDate(dateDepart)
  const retour = toDate(dateRetour)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diff =
    depart && retour ? differenceInCalendarDays(retour, depart) : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Départ
          </span>
          <span
            className={cn(
              "mt-0.5 flex items-center gap-1.5 font-mono text-sm font-medium",
              !depart && "text-muted-foreground"
            )}
          >
            <Calendar className="size-3.5 shrink-0" />
            {depart
              ? format(depart, "d MMM yyyy", { locale: fr })
              : "Non renseignée"}
          </span>
        </div>

        {diff !== undefined && (
          <div className="hidden px-3 text-center sm:block">
            <span className="text-lg font-bold text-primary">
              {diff}
            </span>
            <span className="ml-1 text-xs text-muted-foreground">
              jour{diff > 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div className="flex flex-1 flex-col text-right">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Retour
          </span>
          <span
            className={cn(
              "mt-0.5 flex items-center justify-end gap-1.5 font-mono text-sm font-medium",
              !retour && "text-muted-foreground"
            )}
          >
            <Calendar className="size-3.5 shrink-0" />
            {retour
              ? format(retour, "d MMM yyyy", { locale: fr })
              : "Non renseignée"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={cn("space-y-2", errorDepart && "rounded-lg ring-1 ring-destructive")}>
          <div
            className={cn("rounded-lg border p-3", errorDepart && "border-destructive")}
          >
            <p className="mb-2 text-center text-xs font-semibold uppercase text-muted-foreground">
              Départ
            </p>
            <DayPicker
              mode="single"
              selected={depart}
              onSelect={(d) => onDateDepartChange(toString(d))}
              locale={fr}
              disabled={{ before: today }}
              classNames={classNames}
            />
          </div>
          {errorDepart && (
            <p className="px-1 text-xs text-destructive">{errorDepart}</p>
          )}
        </div>

        <div className={cn("space-y-2", errorRetour && "rounded-lg ring-1 ring-destructive")}>
          <div
            className={cn("rounded-lg border p-3", errorRetour && "border-destructive")}
          >
            <p className="mb-2 text-center text-xs font-semibold uppercase text-muted-foreground">
              Retour
            </p>
            <DayPicker
              mode="single"
              selected={retour}
              onSelect={(d) => onDateRetourChange(toString(d))}
              locale={fr}
              disabled={depart ? { before: depart } : { before: today }}
              classNames={classNames}
            />
          </div>
          {errorRetour && (
            <p className="px-1 text-xs text-destructive">{errorRetour}</p>
          )}
        </div>
      </div>
    </div>
  )
}
