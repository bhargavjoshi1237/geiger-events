import { createPortalWorkflowHandlers } from '@/lib/operations/portal/routes';
const handlers=createPortalWorkflowHandlers();
export const GET=handlers.GET;
export const POST=handlers.POST;
