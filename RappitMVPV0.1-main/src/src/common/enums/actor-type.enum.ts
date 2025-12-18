/**
 * Actor Type Enum
 *
 * Identifies who/what triggered an action in the system.
 * Used for audit trails and timeline events.
 */

export enum ActorType {
  /**
   * Action triggered by a human user via UI/API
   */
  USER = 'USER',

  /**
   * Action triggered by the system automatically
   * (e.g., cron job, scheduled task, auto-reserve)
   */
  SYSTEM = 'SYSTEM',

  /**
   * Action triggered by a sales channel webhook
   * (e.g., Shopify, WooCommerce)
   */
  CHANNEL = 'CHANNEL',

  /**
   * Action triggered by a shipping carrier webhook
   * (e.g., DHL, FedEx tracking update)
   */
  CARRIER = 'CARRIER',

  /**
   * Action triggered by an API integration
   * (e.g., third-party app, custom integration)
   */
  API = 'API',
}
