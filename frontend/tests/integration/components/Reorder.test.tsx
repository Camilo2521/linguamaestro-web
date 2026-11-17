import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Reorder } from '@/components/learning/Reorder';

const SENTENCE = 'Where is the train station?';
const WORDS = SENTENCE.split(' ');

describe('Reorder', () => {
  it('renders every target word as a chip in the word bank', () => {
    render(<Reorder question="Ordena la oración:" correctAnswer={SENTENCE} showFeedback onAnswer={vi.fn()} />);
    for (const word of WORDS) {
      expect(screen.getByRole('button', { name: word })).toBeInTheDocument();
    }
  });

  it('disables "Comprobar" until every word has been picked', () => {
    render(<Reorder question="Ordena la oración:" correctAnswer={SENTENCE} showFeedback onAnswer={vi.fn()} />);
    const submit = screen.getByRole('button', { name: 'Comprobar' });
    expect(submit).toBeDisabled();

    for (const word of WORDS.slice(0, -1)) {
      fireEvent.click(screen.getByRole('button', { name: word }));
    }
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: WORDS[WORDS.length - 1]! }));
    expect(submit).toBeEnabled();
  });

  it('calls onAnswer with the assembled sentence and correct=true when picked in the right order', () => {
    const onAnswer = vi.fn();
    render(<Reorder question="Ordena la oración:" correctAnswer={SENTENCE} showFeedback onAnswer={onAnswer} />);

    for (const word of WORDS) {
      fireEvent.click(screen.getByRole('button', { name: word }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));

    expect(onAnswer).toHaveBeenCalledWith(SENTENCE, true);
  });

  it('calls onAnswer with correct=false and reveals the answer when picked out of order', () => {
    const onAnswer = vi.fn();
    render(<Reorder question="Ordena la oración:" correctAnswer={SENTENCE} showFeedback onAnswer={onAnswer} />);

    // Pick in reverse order — guaranteed wrong for a 5-word sentence.
    for (const word of [...WORDS].reverse()) {
      fireEvent.click(screen.getByRole('button', { name: word }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));

    expect(onAnswer).toHaveBeenCalledWith(WORDS.slice().reverse().join(' '), false);
    expect(screen.getByText(SENTENCE)).toBeInTheDocument();
  });

  it('returns a chip to the bank when tapped again before submitting', () => {
    render(<Reorder question="Ordena la oración:" correctAnswer={SENTENCE} showFeedback onAnswer={vi.fn()} />);

    const whereButtons = () => screen.getAllByRole('button', { name: 'Where' });
    fireEvent.click(whereButtons()[0]!);
    // Now "Where" only appears once, in the answer row — clicking it un-picks it.
    expect(whereButtons()).toHaveLength(1);
    fireEvent.click(whereButtons()[0]!);
    expect(screen.getByRole('button', { name: 'Comprobar' })).toBeDisabled();
  });

  it('locks chip interaction after submitting', () => {
    const onAnswer = vi.fn();
    render(<Reorder question="Ordena la oración:" correctAnswer={SENTENCE} showFeedback onAnswer={onAnswer} />);

    for (const word of WORDS) {
      fireEvent.click(screen.getByRole('button', { name: word }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(onAnswer).toHaveBeenCalledTimes(1);

    // Picked chips are still rendered but disabled — clicking again must not
    // change the outcome or call onAnswer a second time.
    fireEvent.click(screen.getByRole('button', { name: 'Where' }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});
