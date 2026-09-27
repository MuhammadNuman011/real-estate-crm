import { h } from 'gridjs';

export function statusBadge(value) {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'active') {
    return h('span', {
      className: 'badge bg-success-subtle text-success py-2 px-4'
    }, 'ACTIVE');
  }
  if (status === 'inactive') {
    return h('span', {
      className: 'badge bg-danger-subtle text-danger py-2 px-4'
    }, 'INACTIVE');
  }
  if (!status) return '';
  return h('span', {
    className: 'badge bg-secondary-subtle text-secondary py-2 px-4'
  }, status.toUpperCase());
}
