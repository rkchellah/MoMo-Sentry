import { supabase } from './supabase'
import { FraudCheck, BoothLocation } from '../types/sentry'
import { SANDBOX_BOOTHS } from './brand'

export async function getFraudChecks(): Promise<FraudCheck[]> {
    const PAGE = 1000
    const all: FraudCheck[] = []
    let from = 0

    while (true) {
        const { data, error } = await supabase
            .from('fraud_checks')
            .select('*')
            .order('checked_at', { ascending: false })
            .range(from, from + PAGE - 1)

        if (error) throw error
        all.push(...((data ?? []) as FraudCheck[]))
        if ((data?.length ?? 0) < PAGE) break
        from += PAGE
    }

    return all
}

export async function getBoothLocations(): Promise<BoothLocation[]> {
    const { data, error } = await supabase
        .from('booth_locations')
        .select('name, latitude, longitude')
        .order('name')
    if (error) {
        console.error('booth_locations read failed', error.message)
        return SANDBOX_BOOTHS
    }
    const rows = (data ?? []) as BoothLocation[]
    return rows.length > 0 ? rows : SANDBOX_BOOTHS
}
