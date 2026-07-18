import { cn } from "@/lib/utils"

function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="separator"
      className={cn("bg-border shrink-0", "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full", className)}
      {...props}
    />
  )
}

export { Separator }
