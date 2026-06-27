import axios from 'axios'

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!

interface DistanceResult {
  distance: string  // e.g. "2.3 km"
  carEta: string    // e.g. "8 mins"
  transitEta: string
}

interface GeocodedLocality {
  locality: string
  shortAddress: string
}

// Cache to avoid hitting Maps quota repeatedly
const etaCache = new Map<string, { data: DistanceResult; expiry: number }>()
const CACHE_TTL = 60_000 // 1 minute

export async function getDistanceAndETA(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<DistanceResult | null> {
  if (!MAPS_KEY) return null

  const cacheKey = `${originLat.toFixed(3)},${originLng.toFixed(3)}->${destLat.toFixed(3)},${destLng.toFixed(3)}`
  const cached = etaCache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) return cached.data

  try {
    const [carRes, transitRes] = await Promise.all([
      axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: `${originLat},${originLng}`,
          destinations: `${destLat},${destLng}`,
          mode: 'driving',
          key: MAPS_KEY,
        },
      }),
      axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: `${originLat},${originLng}`,
          destinations: `${destLat},${destLng}`,
          mode: 'transit',
          key: MAPS_KEY,
        },
      }),
    ])

    const carEl = carRes.data.rows?.[0]?.elements?.[0]
    const transitEl = transitRes.data.rows?.[0]?.elements?.[0]

    if (carEl?.status !== 'OK') return null

    const result: DistanceResult = {
      distance: carEl.distance.text,
      carEta: carEl.duration.text,
      transitEta: transitEl?.status === 'OK' ? transitEl.duration.text : 'N/A',
    }

    etaCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL })
    return result
  } catch (err) {
    console.error('Maps API error:', err)
    return null
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodedLocality | null> {
  if (!MAPS_KEY) return null

  try {
    const res = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          latlng: `${lat},${lng}`,
          result_type: 'locality|sublocality|neighborhood',
          key: MAPS_KEY,
        },
      },
    )

    const results = res.data.results
    if (!results?.length) return null

    const components = results[0].address_components
    const locality =
      components.find((c: { types: string[]; long_name: string }) =>
        c.types.includes('sublocality_level_1') ||
        c.types.includes('locality'),
      )?.long_name ?? 'Unknown area'

    return { locality, shortAddress: results[0].formatted_address }
  } catch {
    return null
  }
}
