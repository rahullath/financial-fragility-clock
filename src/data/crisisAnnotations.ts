// Crisis annotations exported by Python pipeline (crisis_annotations.json)
// Used by FragilityTimeline and DoomsdayClock for overlay markers.

export interface CrisisEvent {
    date: string;       // ISO date string
    label: string;      // Short label for chart marker
    description: string; // Tooltip / detail text
}

export const TURKISH_CRISIS_EVENTS: CrisisEvent[] = [
    {
        date: "2018-05-23", label: "2018 TRY Pressure",
        description: "USD/TRY begins accelerated depreciation; US sanctions threat."
    },
    {
        date: "2018-08-10", label: "2018 TRY Freefall",
        description: "USD/TRY doubles in 12 months. ISE_USD −45% full-year 2018."
    },
    {
        date: "2021-03-20", label: "CBRT Governor Sacked",
        description: "Third CBRT chief fired in 2 years. TRY −15% in one day."
    },
    {
        date: "2021-11-23", label: "Lira Collapse",
        description: "Erdogan rate-cut cycle. USD/TRY >13 from 8. ISE_USD −40% USD."
    },
    {
        date: "2022-10-01", label: "CPI 85%",
        description: "Turkish CPI hits 85.5% YoY. Dollarization accelerates."
    },
    {
        date: "2023-06-22", label: "Normalisation Begins",
        description: "Şimşek signals orthodox policy. CBRT starts hiking cycle."
    },
    {
        date: "2024-03-21", label: "Rate 50%",
        description: "CBRT reaches 50%. TRY stabilises. Partial ISE_USD recovery."
    },
];

// Regime background bands for the timeline (shaded regions)
export const REGIME_BANDS = [
    { start: "2018-05-01", end: "2018-11-30", regime: "PONZI", label: "2018 TRY Crisis" },
    { start: "2020-03-01", end: "2020-04-30", regime: "PONZI", label: "COVID-19" },
    { start: "2021-03-01", end: "2022-01-31", regime: "PONZI", label: "Lira Collapse" },
    { start: "2013-05-01", end: "2013-09-30", regime: "SPECULATIVE", label: "Taper Tantrum" },
    { start: "2016-07-01", end: "2016-12-31", regime: "SPECULATIVE", label: "Coup Aftermath" },
    { start: "2022-02-01", end: "2023-06-21", regime: "SPECULATIVE", label: "Inflation Crisis" },
];