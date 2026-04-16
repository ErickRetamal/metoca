import { createContext, useContext } from 'react'

interface MenuContextType {
  onMenuPress: () => void
  canManageTasks: boolean
}

export const MenuContext = createContext<MenuContextType | null>(null)

export function useMenuContext() {
  const context = useContext(MenuContext)
  if (!context) {
    throw new Error('useMenuContext must be used within MenuProvider')
  }
  return context
}
