import { setupServer } from 'msw/node';
import { supabaseHandlers } from './handlers/supabase.handlers';

export const server = setupServer(...supabaseHandlers);
