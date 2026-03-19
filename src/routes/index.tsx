import { createFileRoute, redirect } from '@tanstack/react-router'
import { fetchStatesRegistry } from '../services/appConfig'

export const Route = createFileRoute('/')({
  loader: async () => {
    const states = await fetchStatesRegistry()
    const state = states[0]?.id ?? 'tn'
    throw redirect({ to: '/$state/data', params: { state } })
  },
})
