// =============================================================================
// CIC-ERP UI Component Library
// Version: 1.0.0
// =============================================================================

// Core Components
export { default as Button } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

export { default as Input } from './Input';
export type { InputSize } from './Input';

export { default as Badge, StatusBadge } from './Badge';
export type { BadgeVariant, BadgeSize } from './Badge';

export { default as Card, CardHeader, CardContent, CardFooter, StatCard } from './Card';
export type { CardVariant } from './Card';

// Data Display
export { default as DataTable } from './DataTable';
export type { Column, SortConfig, SortDirection } from './DataTable';

// Navigation
export { default as Breadcrumb } from './Breadcrumb';
export type { BreadcrumbItem } from './Breadcrumb';

// Feedback
export { default as Modal } from './Modal';
export { default as ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogVariant } from './ConfirmDialog';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateType } from './EmptyState';

export { default as ErrorState } from './ErrorState';
export { Skeleton } from './Skeleton';
export { DashboardSkeleton, ListPageSkeleton, DetailPageSkeleton, FormPageSkeleton, AnalyticsSkeleton } from './PageSkeletons';
export { default as Tooltip } from './Tooltip';

// Form Components
export { default as SearchableSelect } from './SearchableSelect';
export { default as QuickAddCustomerDialog } from './QuickAddCustomerDialog';
export { default as NumberInput } from './NumberInput';
export { Avatar, AvatarImage, AvatarFallback } from './Avatar';
