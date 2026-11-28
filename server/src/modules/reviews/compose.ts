import type { Container } from '../../platform/container.js';
import { ReviewService, type ReviewServiceDeps } from './service.js';

/** Module composition root: builds the review service from the app container. */
export function createReviewService(container: ReviewServiceDeps & Pick<Container, 'reviewRepo'>): ReviewService {
  return new ReviewService(container, container.reviewRepo);
}
