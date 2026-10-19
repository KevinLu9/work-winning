import { Globe2, Lock, Share2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useMeta } from "@/lib/persona"
import { cn } from "@/lib/utils"
import type { Visibility } from "@/lib/types"

export interface VisibilityValue {
  visibility: Visibility
  shares: string[]
}

/** Sector only / Shared with sectors / Enterprise. Used by the Submit wizard and the admin "Change visibility" dialog. */
export function VisibilityPicker({ value, onChange, sector, error }: {
  value: VisibilityValue; onChange: (v: VisibilityValue) => void; sector: string; error?: string
}) {
  const { data: meta } = useMeta()
  if (!meta) return null
  return (
    <div className="space-y-6">
      <RadioGroup value={value.visibility} onValueChange={(v) => onChange({ ...value, visibility: v as Visibility })} className="gap-3">
        {meta.visibility.map((v) => {
          const Icon = v.value === "sector_only" ? Lock : v.value === "shared" ? Share2 : Globe2
          return (
            <Label key={v.value} htmlFor={`vis-${v.value}`}
              className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal", value.visibility === v.value && "border-primary bg-secondary")}>
              <RadioGroupItem id={`vis-${v.value}`} value={v.value} className="mt-1" />
              <Icon className="mt-0.5 size-5 text-brand-mid" />
              <div>
                <div className="font-semibold">{v.label}{v.value === "sector_only" && <span className="ml-2 text-xs font-normal text-muted-foreground">(default)</span>}</div>
                <div className="text-sm text-muted-foreground">{v.description}</div>
              </div>
            </Label>
          )
        })}
      </RadioGroup>
      {value.visibility === "shared" && (
        <div className="space-y-1.5">
          <Label className={cn(error && "text-destructive")}>Share with sectors <span className="text-destructive">*</span></Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {meta.sectors.filter((s) => s.name !== sector).map((s) => (
              <label key={s.name} className="flex items-center gap-2 text-sm">
                <Checkbox checked={value.shares.includes(s.name)}
                  onCheckedChange={(c) => onChange({ ...value, shares: c ? [...value.shares, s.name] : value.shares.filter((x) => x !== s.name) })} />
                {s.name}
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}
