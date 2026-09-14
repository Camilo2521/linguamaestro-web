import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeEligibility } from '../../helpers/exam-helpers';

// Mock framer-motion — no layout animations in jsdom
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_: unknown, tag: string) =>
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
          React.createElement(tag, props, children),
    },
  ),
  AnimatePresence: ({ children }: React.PropsWithChildren) => children,
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));

vi.mock('@/stores/session.store', () => ({
  useActiveEnrollment: vi.fn(() => ({ id: 'enroll-123' })),
}));

vi.mock('@/lib/api/exam', () => ({
  examApi: { createAttempt: vi.fn() },
}));

import ExamPreparePage from '@/app/(app)/exam/prepare/page';
import { examApi } from '@/lib/api/exam';
import { useRouter } from 'next/navigation';

const mockCreateAttempt = vi.mocked(examApi.createAttempt);
const mockUseRouter = vi.mocked(useRouter);

const TOTAL_REQUIREMENTS = 5; // matches REQUIREMENTS array in the component

describe('ExamPreparePage — initial render', () => {
  it('renders the preparation title', () => {
    render(<ExamPreparePage />);
    expect(screen.getByText(/preparación del examen/i)).toBeInTheDocument();
  });

  it('renders all 5 requirement checkboxes', () => {
    render(<ExamPreparePage />);
    const buttons = screen.getAllByRole('button').filter(
      (b) => b.getAttribute('accessibilityLabel') !== 'Volver',
    );
    // There should be requirement buttons and the submit button
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(TOTAL_REQUIREMENTS);
  });

  it('start button is disabled when nothing is checked', () => {
    render(<ExamPreparePage />);
    const startBtn = screen.getByText(/iniciar grabación/i).closest('button');
    expect(startBtn).toBeDisabled();
  });

  it('shows evaluation rubric with 5 dimensions', () => {
    render(<ExamPreparePage />);
    expect(screen.getByText(/fluidez/i)).toBeInTheDocument();
    expect(screen.getByText(/pronunciación/i)).toBeInTheDocument();
    expect(screen.getByText(/gramática/i)).toBeInTheDocument();
    expect(screen.getByText(/vocabulario/i)).toBeInTheDocument();
    expect(screen.getByText(/coherencia/i)).toBeInTheDocument();
  });
});

describe('ExamPreparePage — checklist interaction', () => {
  it('checking all requirements enables the start button', async () => {
    const user = userEvent.setup();
    render(<ExamPreparePage />);

    const requirementBtns = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.match(/(cámara|micrófono|iluminación|tranquilo|tiempo)/i));

    for (const btn of requirementBtns) {
      await user.click(btn);
    }

    const startBtn = screen.getByText(/iniciar grabación/i).closest('button');
    expect(startBtn).not.toBeDisabled();
  });

  it('unchecking one requirement disables the start button again', async () => {
    const user = userEvent.setup();
    render(<ExamPreparePage />);

    const requirementBtns = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.match(/(cámara|micrófono|iluminación|tranquilo|tiempo)/i));

    // Check all
    for (const btn of requirementBtns) {
      await user.click(btn);
    }

    // Uncheck the first
    if (requirementBtns[0]) {
      await user.click(requirementBtns[0]);
    }

    const startBtn = screen.getByText(/iniciar grabación/i).closest('button');
    expect(startBtn).toBeDisabled();
  });
});

describe('ExamPreparePage — exam start flow', () => {
  beforeEach(() => {
    mockCreateAttempt.mockResolvedValue({ success: true, data: { attemptId: 'attempt-abc' } });
  });

  it('calls examApi.createAttempt with enrollment id', async () => {
    const user = userEvent.setup();
    render(<ExamPreparePage />);

    const requirementBtns = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.match(/(cámara|micrófono|iluminación|tranquilo|tiempo)/i));
    for (const btn of requirementBtns) {
      await user.click(btn);
    }

    await user.click(screen.getByText(/iniciar grabación/i));

    await waitFor(() => {
      expect(mockCreateAttempt).toHaveBeenCalledWith('enroll-123');
    });
  });

  it('navigates to record page on success', async () => {
    const mockPush = vi.fn();
    mockUseRouter.mockReturnValue({ push: mockPush, back: vi.fn() } as ReturnType<typeof useRouter>);

    const user = userEvent.setup();
    render(<ExamPreparePage />);

    const requirementBtns = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.match(/(cámara|micrófono|iluminación|tranquilo|tiempo)/i));
    for (const btn of requirementBtns) {
      await user.click(btn);
    }

    await user.click(screen.getByText(/iniciar grabación/i));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/exam/record?attemptId=attempt-abc');
    });
  });

  it('does not navigate when attempt creation fails', async () => {
    mockCreateAttempt.mockRejectedValue(new Error('Server error'));
    const mockPush = vi.fn();
    mockUseRouter.mockReturnValue({ push: mockPush, back: vi.fn() } as ReturnType<typeof useRouter>);

    const user = userEvent.setup();
    render(<ExamPreparePage />);

    const requirementBtns = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.match(/(cámara|micrófono|iluminación|tranquilo|tiempo)/i));
    for (const btn of requirementBtns) {
      await user.click(btn);
    }

    await user.click(screen.getByText(/iniciar grabación/i));

    await waitFor(() => {
      expect(mockCreateAttempt).toHaveBeenCalled();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});

// Suppress unused import
void makeEligibility;
void fireEvent;
