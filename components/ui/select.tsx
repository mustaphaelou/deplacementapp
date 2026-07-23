"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "@/lib/utils"
import { Label } from "./label"
import { Check, ChevronDown } from "lucide-react"

function Select({
  className,
  children,
  label,
  error,
  value,
  onValueChange,
  ...props
}: {
  className?: string
  children: React.ReactNode
  label?: string
  error?: string
  value?: string | null
  onValueChange?: (value: string | null) => void
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label>{label}</Label>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SelectPrimitive.Root value={value as string | undefined} onValueChange={(v) => onValueChange?.(v as string | null)} {...props as any}>
        <SelectPrimitive.Trigger
          className={cn(
            "border-input flex h-8 w-full items-center justify-between rounded-lg border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            error && "border-destructive"
          )}
        >
          <SelectPrimitive.Value placeholder="Sélectionner..." />
          <SelectPrimitive.Icon>
            <ChevronDown className="size-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner>
            <SelectPrimitive.Popup
              className={cn(
                "bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-hidden rounded-lg border shadow-md",
                "origin-[var(--anchor-transform-origin)] transition-[transform,scale,opacity]",
                "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
                "data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
              )}
            >
              <SelectPrimitive.Arrow className="fill-popover" />
              {children}
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectItem }
