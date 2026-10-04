import { createWorkflowHandlers } from '@/lib/operations/workflow/routes';
const handlers=createWorkflowHandlers();
export const GET=handlers.GET;
export const POST=handlers.POST;
