import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts"
import { money } from "@/lib/format"

/**
 * Categorical chart palette, validated with the dataviz palette validator (light surface, all checks pass).
 * Slot order is fixed: slot 1 = Ventia mid green, slot 2 = plum (from Ventia plum), slot 3 = burnt orange
 * (from Ventia red earth). The deep green fails the lightness band for marks, so it stays the UI ink colour.
 */
export const SERIES = ["#00994d", "#8a2a48", "#c8642e"] as const

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" }

export interface SeriesDef {
  key: string
  label: string
}

function ChartTooltip({ active, payload, label, format }: TooltipProps<number, string> & { format: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey as string} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">{format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

export function Bars({
  data,
  xKey,
  series,
  stacked = false,
  layout = "horizontal",
  format = (v: number) => money(v),
  height = 240,
}: {
  data: Record<string, unknown>[]
  xKey: string
  series: SeriesDef[]
  stacked?: boolean
  layout?: "horizontal" | "vertical"
  format?: (v: number) => string
  height?: number
}) {
  const vertical = layout === "vertical"
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={vertical ? "vertical" : "horizontal"} margin={{ top: 4, right: 8, bottom: 0, left: vertical ? 8 : 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={AXIS} tickFormatter={(v) => format(v)} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={xKey} tick={AXIS} width={130} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={AXIS} tickFormatter={(v) => format(v)} axisLine={false} tickLine={false} width={56} />
          </>
        )}
        <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip format={format} />} />
        {series.length > 1 && <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />}
        {series.map((s, i) => {
          const last = !stacked || i === series.length - 1
          const radius: [number, number, number, number] = last ? (vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) : [0, 0, 0, 0]
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={SERIES[i]}
              stackId={stacked ? "a" : undefined}
              radius={radius}
              stroke="var(--card)"
              strokeWidth={stacked ? 2 : 0}
              maxBarSize={vertical ? 18 : 36}
            />
          )
        })}
      </BarChart>
    </ResponsiveContainer>
  )
}
