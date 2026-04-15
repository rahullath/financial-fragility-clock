// src/hooks/useModelBData.ts
import { useMemo } from 'react'
import outputsRaw from '../data/model_b_outputs.json'
import slimRaw from '../data/model_b_features_slim.json'

export interface WalkForwardSplit {
    split_name: string
    train_end: string
    test_start: string
    test_end: string
    r2: number
    rmse: number
    mae: number
    regime_rmse: { HEDGE: number; SPECULATIVE: number; PONZI: number }
    top_features: { feature: string; importance: number }[]
}

export interface ShapPeriod {
    period: string
    start_date: string
    end_date: string
    top_features: { feature: string; mean_abs_shap: number }[]
    dominant_macro: string
}

export interface TimeRow {
    date: string
    fragility_score: number
    regime: 'HEDGE' | 'SPECULATIVE' | 'PONZI'
    crash_probability: number
    ISE_USD?: number
    USDTRY?: number
}

export function useModelBData() {
    const outputs = outputsRaw as any
    const slim = slimRaw as any

    const walkForward: WalkForwardSplit[] = useMemo(
        () => outputs?.walk_forward_results ?? [],
        [outputs]
    )

    const shapPeriods: ShapPeriod[] = useMemo(
        () => outputs?.shap_results ?? [],
        [outputs]
    )

    const timeSeries: TimeRow[] = useMemo(
        () => (slim?.data ?? []) as TimeRow[],
        [slim]
    )

    const latestScore: number = useMemo(() => {
        const valid = timeSeries.filter(r => r.fragility_score != null)
        return valid.length ? valid[valid.length - 1].fragility_score : 0
    }, [timeSeries])

    const currentRegime = useMemo(() => {
        const valid = timeSeries.filter(r => r.regime != null)
        return valid.length ? valid[valid.length - 1].regime : 'SPECULATIVE'
    }, [timeSeries])

    return { walkForward, shapPeriods, timeSeries, latestScore, currentRegime }
}