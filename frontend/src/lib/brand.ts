import { BoothLocation } from '../types/sentry'

export const PRODUCT_NAME = 'MoMo Sentry'

/** Lusaka booths used when booth_locations is empty or blocked by RLS. */
export const SANDBOX_BOOTHS: BoothLocation[] = [
  { name: 'Cairo Road Shoprite', latitude: -15.41814, longitude: 28.28243 },
  { name: 'City Market', latitude: -15.42580, longitude: 28.27790 },
  { name: 'Kamwala Market', latitude: -15.43090, longitude: 28.29240 },
  { name: 'Manda Hill', latitude: -15.39776, longitude: 28.30707 },
  { name: 'Levy Junction', latitude: -15.41362, longitude: 28.28552 },
  { name: 'Chilenje', latitude: -15.44620, longitude: 28.33610 },
]
