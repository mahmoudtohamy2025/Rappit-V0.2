/**
 * Order State Machine - 11-State Lifecycle
 *
 * Defines valid state transitions for the order lifecycle.
 * Ensures business rules are enforced at the application level.
 */

import { OrderStatus } from '@prisma/client';

/**
 * Valid state transitions map
 *
 * Each status maps to an array of allowed next statuses.
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // NEW: Order just imported from channel
  NEW: [
    'RESERVED',      // Inventory successfully reserved
    'CANCELLED',     // Order cancelled before processing
    'FAILED',        // Failed to process
  ],

  // RESERVED: Inventory reserved, awaiting payment/approval
  RESERVED: [
    'READY_TO_SHIP', // Payment confirmed, ready to ship
    'CANCELLED',     // Order cancelled after reserve
    'FAILED',        // Payment failed or other issue
  ],

  // READY_TO_SHIP: Payment confirmed, ready for label creation
  READY_TO_SHIP: [
    'LABEL_CREATED', // Shipping label created
    'CANCELLED',     // Order cancelled before shipping
  ],

  // LABEL_CREATED: Shipping label generated
  LABEL_CREATED: [
    'PICKED_UP',     // Carrier picked up package
    'CANCELLED',     // Order cancelled (may incur fees)
  ],

  // PICKED_UP: Package picked up by carrier
  PICKED_UP: [
    'IN_TRANSIT',    // Package in transit
    'FAILED',        // Pickup failed or lost
  ],

  // IN_TRANSIT: Package in transit to customer
  IN_TRANSIT: [
    'OUT_FOR_DELIVERY', // Out for delivery
    'DELIVERED',        // Delivered (if carrier skips OUT_FOR_DELIVERY)
    'FAILED',           // Delivery failed
  ],

  // OUT_FOR_DELIVERY: Package out for delivery
  OUT_FOR_DELIVERY: [
    'DELIVERED',     // Successfully delivered
    'FAILED',        // Delivery attempt failed
  ],

  // DELIVERED: Successfully delivered (terminal state)
  DELIVERED: [
    'RETURNED',      // Customer initiated return
  ],

  // CANCELLED: Order cancelled (terminal state)
  CANCELLED: [
    // Terminal state - no transitions allowed
  ],

  // FAILED: Delivery failed
  FAILED: [
    'IN_TRANSIT',    // Retry delivery
    'CANCELLED',     // Give up, cancel order
    'RETURNED',      // Return to sender
  ],

  // RETURNED: Order returned (terminal state)
  RETURNED: [
    // Terminal state - no transitions allowed
  ],
};

/**
 * Check if a state transition is valid
 *
 * @param fromStatus - Current order status
 * @param toStatus - Desired new status
 * @returns true if transition is allowed, false otherwise
 */
export function canTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): boolean {
  const allowedTransitions = VALID_TRANSITIONS[fromStatus];
  return allowedTransitions.includes(toStatus);
}

/**
 * Get all valid next statuses for a given status
 *
 * @param currentStatus - Current order status
 * @returns Array of allowed next statuses
 */
export function getValidNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if a status is a terminal state
 *
 * @param status - Order status to check
 * @returns true if status has no valid transitions
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  const allowedTransitions = VALID_TRANSITIONS[status];
  return allowedTransitions.length === 0;
}

/**
 * Get human-readable status name
 *
 * @param status - Order status
 * @returns Formatted status name
 */
export function getStatusDisplayName(status: OrderStatus): string {
  const names: Record<OrderStatus, string> = {
    NEW: 'New',
    RESERVED: 'Reserved',
    READY_TO_SHIP: 'Ready to Ship',
    LABEL_CREATED: 'Label Created',
    PICKED_UP: 'Picked Up',
    IN_TRANSIT: 'In Transit',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    FAILED: 'Failed',
    RETURNED: 'Returned',
  };

  return names[status] || status;
}

/**
 * Determine if inventory should be reserved at this status
 *
 * @param status - Order status
 * @returns true if inventory should be reserved
 */
export function shouldReserveInventory(status: OrderStatus): boolean {
  return ['NEW', 'RESERVED'].includes(status);
}

/**
 * Determine if inventory should be released at this status
 *
 * @param status - Order status
 * @returns true if inventory should be released
 */
export function shouldReleaseInventory(status: OrderStatus): boolean {
  return ['CANCELLED', 'RETURNED'].includes(status);
}

/**
 * Get the timestamp field name for a given status
 *
 * @param status - Order status
 * @returns Timestamp field name or null
 */
export function getTimestampFieldForStatus(status: OrderStatus): string | null {
  const timestampFields: Partial<Record<OrderStatus, string>> = {
    NEW: 'importedAt',
    RESERVED: 'reservedAt',
    READY_TO_SHIP: 'readyToShipAt',
    LABEL_CREATED: 'shippedAt', // Label created is considered start of shipping
    PICKED_UP: 'shippedAt',     // Or use a separate pickedUpAt field if needed
    IN_TRANSIT: 'shippedAt',
    OUT_FOR_DELIVERY: 'shippedAt',
    DELIVERED: 'deliveredAt',
    CANCELLED: 'cancelledAt',
    RETURNED: 'returnedAt',
  };

  return timestampFields[status] || null;
}
