'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface SidebarCtx { collapsed: boolean; toggle: () => void }

const Ctx = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} })

export function useSidebar() { return useContext(Ctx) }

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true)
  }, [])

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', String(!c))
      return !c
    })
  }

  return <Ctx.Provider value={{ collapsed, toggle }}>{children}</Ctx.Provider>
}
