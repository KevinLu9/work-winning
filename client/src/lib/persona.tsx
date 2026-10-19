import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, getPersona, setPersona } from "./api"
import type { Meta, User } from "./types"

interface PersonaContextValue {
  personaId: string
  user: User | undefined
  switchPersona: (id: string) => void
}

const PersonaContext = createContext<PersonaContextValue | null>(null)

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [personaId, setPersonaId] = useState(getPersona)
  const queryClient = useQueryClient()
  const { data: meta } = useMeta()

  const switchPersona = useCallback(
    (id: string) => {
      setPersona(id)
      setPersonaId(id)
      // Every query result depends on who is asking (sector-first permissions).
      queryClient.invalidateQueries()
    },
    [queryClient],
  )

  const user = meta?.users.find((u) => u.id === personaId)
  const value = useMemo(() => ({ personaId, user, switchPersona }), [personaId, user, switchPersona])
  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
}

export function usePersona() {
  const ctx = useContext(PersonaContext)
  if (!ctx) throw new Error("usePersona must be used inside PersonaProvider")
  return ctx
}

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/meta"), staleTime: Infinity })
}
