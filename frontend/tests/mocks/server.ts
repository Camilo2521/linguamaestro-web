import { setupServer } from 'msw/node';
import { supabaseHandlers } from './handlers/supabase.handlers';
import { aiEvaluatorHandlers } from './handlers/ai-evaluator.handlers';

export const server = setupServer(...supabaseHandlers, ...aiEvaluatorHandlers);
