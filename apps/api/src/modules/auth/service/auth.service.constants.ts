/** CSRF `state` token size in bytes (256 bits of entropy). */
export const STATE_BYTES = 32;

/**
 * Password length bounds (ADR 0043). No composition rules, following NIST
 * SP 800-63B: forced symbol and case mixes push people toward predictable
 * patterns. The maximum exists so a pathological input cannot turn a
 * deliberately expensive hash into a denial of service.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
