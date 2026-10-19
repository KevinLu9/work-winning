import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download, ExternalLink, FileText, ImageIcon, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react"
import { PhotoPlaceholder } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { api, publicUrl, uploadUrl } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Attachment, AttachmentRole } from "@/lib/types"

// Fallback banners for items without an uploaded hero (client/public/heroes; add files there and list them here).
// The shareable build inlines this folder (vite.config.ts), so publicUrl works there too.
const FALLBACK_HEROES = [1, 2, 3, 4, 5, 6].map((n) => `/heroes/banner-${n}.svg`)

/** The uploaded hero if there is one, otherwise a stock banner picked by seed, otherwise the gradient placeholder. */
export function HeroBanner({ heroId, seed, type, className }: { heroId?: string | null; seed: number; type: string; className?: string }) {
  const src = heroId ? uploadUrl(heroId) : publicUrl(FALLBACK_HEROES[seed % FALLBACK_HEROES.length])
  if (!src) return <PhotoPlaceholder seed={seed} type={type} className={className} />
  return <img src={src} alt="" loading="lazy" className={cn("w-full object-cover object-[50%_25%]", className)} />
}

// Same limits as server/app/routes/content.py (ALLOWED_UPLOADS, MAX_CONTENT_LENGTH).
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const ACCEPT: Record<AttachmentRole, string> = { hero: IMAGE_MIME.join(","), image: IMAGE_MIME.join(","), document: "application/pdf" }

/** Client-side mirror of the server check; returns an error message or null. */
export function checkFile(role: AttachmentRole, file: File): string | null {
  const ok = role === "document" ? file.type === "application/pdf" : IMAGE_MIME.includes(file.type)
  if (!ok) return `${file.name}: only ${role === "document" ? "PDF files" : "PNG, JPG, WebP or GIF images"} are accepted`
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 25 MB`
  return null
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Keep the valid files, toast the rest. */
function accept(role: AttachmentRole, files: FileList | File[] | null): File[] {
  const ok: File[] = []
  for (const f of Array.from(files ?? [])) {
    const err = checkFile(role, f)
    if (err) toast.error(err)
    else ok.push(f)
  }
  return ok
}

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}

/** A click-or-drop target that hands accepted files to onFiles. */
function DropZone({ role, multiple, onFiles, className, children }: {
  role: AttachmentRole; multiple?: boolean; onFiles: (files: File[]) => void; className?: string; children: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const files = accept(role, e.dataTransfer.files)
        if (files.length) onFiles(multiple ? files : files.slice(0, 1))
      }}
      className={cn("flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground transition hover:border-brand-mid/60 hover:bg-muted/60",
        over && "border-brand-mid bg-secondary", className)}
    >
      <input ref={input} type="file" hidden multiple={multiple} accept={ACCEPT[role]}
        onChange={(e) => {
          const files = accept(role, e.target.files)
          if (files.length) onFiles(files)
          e.target.value = ""
        }} />
      {children}
    </div>
  )
}

function FileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useObjectUrl(file)
  return (
    <div className="group relative overflow-hidden rounded-lg border">
      {url && <img src={url} alt={file.name} className="aspect-[4/3] w-full object-cover" />}
      <div className="truncate px-2 py-1 text-xs text-muted-foreground">{file.name}</div>
      <Button type="button" size="icon" variant="secondary" className="absolute top-1 right-1 size-7" onClick={onRemove} aria-label={`Remove ${file.name}`}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function DocRow({ name, size, actions }: { name: string; size: number; actions: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border p-2.5">
      <FileText className="size-5 shrink-0 text-destructive/80" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">PDF · {fileSize(size)}</div>
      </div>
      {actions}
    </li>
  )
}

export interface MediaFiles {
  hero: File | null
  images: File[]
  documents: File[]
}

export const NO_MEDIA: MediaFiles = { hero: null, images: [], documents: [] }

/** Submit wizard step: pick a hero banner, extra images and PDFs. Files upload after the item is created. */
export function MediaPicker({ value, onChange }: { value: MediaFiles; onChange: (v: MediaFiles) => void }) {
  const heroUrl = useObjectUrl(value.hero)
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div>
          <div className="text-sm font-medium">Hero banner</div>
          <p className="text-xs text-muted-foreground">Shown across the top of the page and on library cards. A wide landscape photo works best (about 1600 × 600). Optional.</p>
        </div>
        {heroUrl ? (
          <div className="relative overflow-hidden rounded-xl border">
            <img src={heroUrl} alt="Hero banner preview" className="h-48 w-full object-cover sm:h-72" />
            <Button type="button" size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => onChange({ ...value, hero: null })}>
              <X className="size-4" /> Remove
            </Button>
          </div>
        ) : (
          <DropZone role="hero" onFiles={([f]) => onChange({ ...value, hero: f })} className="h-48 sm:h-72">
            <ImagePlus className="size-8 text-brand-mid" />
            <span className="font-medium text-foreground">Drop a hero image here or click to browse</span>
            <span className="text-xs">PNG, JPG, WebP or GIF · up to 25 MB</span>
          </DropZone>
        )}
      </section>

      <section className="space-y-2">
        <div>
          <div className="text-sm font-medium">Additional images</div>
          <p className="text-xs text-muted-foreground">Site photos, diagrams or before/after shots for the gallery.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.images.map((f, i) => (
            <FileThumb key={`${f.name}-${i}`} file={f} onRemove={() => onChange({ ...value, images: value.images.filter((_, j) => j !== i) })} />
          ))}
          <DropZone role="image" multiple onFiles={(fs) => onChange({ ...value, images: [...value.images, ...fs] })} className="aspect-[4/3]">
            <ImageIcon className="size-6 text-brand-mid" />
            <span className="text-xs">Add images</span>
          </DropZone>
        </div>
      </section>

      <section className="space-y-2">
        <div>
          <div className="text-sm font-medium">Documents (PDF)</div>
          <p className="text-xs text-muted-foreground">Fact sheets, client letters or the full case study document.</p>
        </div>
        {value.documents.length > 0 && (
          <ul className="space-y-2">
            {value.documents.map((f, i) => (
              <DocRow key={`${f.name}-${i}`} name={f.name} size={f.size} actions={
                <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`Remove ${f.name}`}
                  onClick={() => onChange({ ...value, documents: value.documents.filter((_, j) => j !== i) })}>
                  <X className="size-4" />
                </Button>
              } />
            ))}
          </ul>
        )}
        <DropZone role="document" multiple onFiles={(fs) => onChange({ ...value, documents: [...value.documents, ...fs] })}>
          <Upload className="size-5 text-brand-mid" />
          <span>Drop PDFs here or click to browse</span>
        </DropZone>
      </section>
    </div>
  )
}

/** Upload every picked file to a content item. Returns the names that failed. */
export async function uploadMedia(contentId: string, media: MediaFiles): Promise<string[]> {
  const jobs: [AttachmentRole, File][] = [
    ...(media.hero ? [["hero", media.hero] as [AttachmentRole, File]] : []),
    ...media.images.map((f) => ["image", f] as [AttachmentRole, File]),
    ...media.documents.map((f) => ["document", f] as [AttachmentRole, File]),
  ]
  const failed: string[] = []
  for (const [role, file] of jobs) {
    const form = new FormData()
    form.append("role", role)
    form.append("file", file)
    try {
      await api.upload(`/content/${contentId}/attachments`, form)
    } catch {
      failed.push(file.name)
    }
  }
  return failed
}

/** Detail page: gallery (with lightbox) and PDF list; owners can add and remove media. */
export function MediaPanel({ contentId, attachments, canEdit }: { contentId: string; attachments: Attachment[]; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<Attachment | null>(null)
  const images = attachments.filter((a) => a.role === "image")
  const docs = attachments.filter((a) => a.role === "document")
  const hero = attachments.find((a) => a.role === "hero")

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["content", contentId] })
  const add = useMutation({
    mutationFn: ({ role, files }: { role: AttachmentRole; files: File[] }) =>
      uploadMedia(contentId, { hero: role === "hero" ? files[0] : null, images: role === "image" ? files : [], documents: role === "document" ? files : [] }),
    onSuccess: (failed) => {
      if (failed.length) toast.error(`Could not upload ${failed.join(", ")}`)
      else toast.success("Media uploaded")
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (a: Attachment) => api.delete(`/content/${contentId}/attachments/${a.id}`),
    onSuccess: () => { toast.success("Removed"); refresh() },
    onError: (e) => toast.error(e.message),
  })

  if (!canEdit && images.length === 0 && docs.length === 0) return null
  const busy = add.isPending || remove.isPending
  const removeButton = (a: Attachment, className?: string) => canEdit && (
    <Button type="button" size="icon" variant="secondary" className={cn("size-7", className)} disabled={busy}
      onClick={(e) => { e.stopPropagation(); remove.mutate(a) }} aria-label={`Remove ${a.filename}`}>
      <Trash2 className="size-3.5" />
    </Button>
  )

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-primary">Media & documents</h2>
        {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">Hero banner:</span>
          {hero ? <span className="truncate font-medium">{hero.filename}</span> : <span className="text-muted-foreground">stock banner (none uploaded)</span>}
          <DropZone role="hero" onFiles={(files) => add.mutate({ role: "hero", files })} className="ml-auto flex-row border px-3 py-1.5 text-xs">
            <ImagePlus className="size-4" /> {hero ? "Replace" : "Upload"}
          </DropZone>
          {hero && removeButton(hero)}
        </div>
      )}

      {(images.length > 0 || canEdit) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-lg border">
              <button type="button" onClick={() => setOpen(a)} className="block w-full" aria-label={`View ${a.filename}`}>
                <img src={uploadUrl(a.id)} alt={a.filename} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
              </button>
              {removeButton(a, "absolute top-1 right-1")}
            </div>
          ))}
          {canEdit && (
            <DropZone role="image" multiple onFiles={(files) => add.mutate({ role: "image", files })} className="aspect-[4/3]">
              <ImageIcon className="size-6 text-brand-mid" />
              <span className="text-xs">Add images</span>
            </DropZone>
          )}
        </div>
      )}

      {(docs.length > 0 || canEdit) && (
        <ul className="space-y-2">
          {docs.map((a) => (
            <DocRow key={a.id} name={a.filename} size={a.size} actions={
              <div className="flex shrink-0 gap-1">
                <Button asChild size="sm" variant="ghost"><a href={uploadUrl(a.id)} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open</a></Button>
                <Button asChild size="icon" variant="ghost" className="size-8"><a href={uploadUrl(a.id, true)} download={a.filename} aria-label={`Download ${a.filename}`}><Download className="size-4" /></a></Button>
                {removeButton(a)}
              </div>
            } />
          ))}
          {canEdit && (
            <li>
              <DropZone role="document" multiple onFiles={(files) => add.mutate({ role: "document", files })} className="flex-row p-3">
                <Upload className="size-4 text-brand-mid" /> Add PDF documents
              </DropZone>
            </li>
          )}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl p-2 sm:max-w-4xl">
          <DialogTitle className="sr-only">{open?.filename}</DialogTitle>
          {open && <img src={uploadUrl(open.id)} alt={open.filename} className="max-h-[80vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </section>
  )
}
