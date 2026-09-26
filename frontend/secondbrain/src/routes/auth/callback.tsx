import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { CallbackPage } from '@/features/auth/pages/CallbackPage';

/**
 * OAuth2 콜백 라우트 (/auth/callback)
 * - code 파라미터를 통해 Authorization Code 수신
 * - error 파라미터로 에러 처리
 */

const searchSchema = z.object({
  code: z.string().optional().catch(undefined),
  error: z.string().optional().catch(undefined),
});

export type CallbackSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute('/auth/callback')({
  validateSearch: (search): CallbackSearch => searchSchema.parse(search),
  component: CallbackPage,
});
