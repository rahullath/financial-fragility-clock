import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import NetworkMST from './NetworkMST';

vi.mock('../contexts/ModelContext', () => ({
  useModelContext: () => ({
    currentModelData: {
      info: {
        indices: ['ISE', 'SP500', 'DAX', 'FTSE'],
      },
      featuresData: {
        data: [
          {
            date: '2026-01-01',
            pairwise_correlations: {
              ISE_USD_SP500: 0.71,
              ISE_USD_DAX: 0.66,
              ISE_USD_FTSE: 0.62,
              SP500_DAX: 0.84,
              SP500_FTSE: 0.79,
              DAX_FTSE: 0.88,
            },
            SP500_volatility: 0.12,
            DAX_volatility: 0.14,
            FTSE_volatility: 0.1,
          },
        ],
      },
    },
  }),
  DataRow: {},
}));

vi.mock('../contexts/DateContext', () => ({
  useDateContext: () => ({
    selectedDate: new Date('2026-01-01'),
  }),
}));

vi.mock('../utils/exportChart', () => ({
  exportChart: vi.fn(),
}));

describe('NetworkMST', () => {
  it('renders MST edges with resolved coordinates', async () => {
    const { container } = render(<NetworkMST />);

    await waitFor(() => {
      const lines = Array.from(container.querySelectorAll('line'));

      expect(lines.length).toBe(3);

      const hasResolvedEdge = lines.some((line) => {
        const x1 = Number(line.getAttribute('x1'));
        const y1 = Number(line.getAttribute('y1'));
        const x2 = Number(line.getAttribute('x2'));
        const y2 = Number(line.getAttribute('y2'));

        return [x1, y1, x2, y2].every((value) => Number.isFinite(value))
          && !(x1 === 0 && y1 === 0 && x2 === 0 && y2 === 0);
      });

      expect(hasResolvedEdge).toBe(true);
    });
  });
});
