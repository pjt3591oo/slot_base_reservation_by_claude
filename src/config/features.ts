/**
 * Feature flags for the reservation system
 */
export const features = {
  /**
   * Enable slot-based reservation system
   * When true, uses SlotManager for better concurrency
   * When false, uses traditional lock-based system
   */
  useSlotBasedReservation: process.env.USE_SLOT_BASED_RESERVATION === 'true' || false,

  /**
   * Number of slots per section (deprecated - now uses 1:1 mapping)
   * @deprecated Slots are now 1:1 mapped with seats
   */
  defaultSlotsPerSection: parseInt(process.env.DEFAULT_SLOTS_PER_SECTION || '10'),

  /**
   * Enable parallel slot reservation
   */
  enableParallelSlotReservation: process.env.ENABLE_PARALLEL_SLOT_RESERVATION !== 'false',

  /**
   * Slot reservation timeout in seconds
   */
  slotReservationTimeout: parseInt(process.env.SLOT_RESERVATION_TIMEOUT || '900'), // 15 minutes

  /**
   * Enable automatic slot cleanup
   */
  enableAutoSlotCleanup: process.env.ENABLE_AUTO_SLOT_CLEANUP !== 'false',
};