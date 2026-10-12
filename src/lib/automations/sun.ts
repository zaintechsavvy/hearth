const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J2000 = 2451545;

const toJulian = (date: Date) => date.getTime() / DAY_MS - 0.5 + 2440588;
const fromJulian = (julian: number) => new Date((julian + 0.5 - 2440588) * DAY_MS);

/**
 * Sunrise and sunset for a date at a place, from the standard solar position equations (the ones NOAA and
 * SunCalc use), accurate to about a minute. Null on days the sun never rises or never sets there.
 */
export function sunTimes(date: Date, latitude: number, longitude: number): { sunrise: Date; sunset: Date } | null {
  const noonLocal = new Date(date);
  noonLocal.setHours(12, 0, 0, 0);
  const days = Math.round(toJulian(noonLocal) - J2000 - 0.0009 + longitude / 360);
  const transitApprox = J2000 + 0.0009 - longitude / 360 + days;
  const anomaly = (357.5291 + 0.98560028 * (transitApprox - J2000)) * RAD;
  const center = (1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly) + 0.0003 * Math.sin(3 * anomaly)) * RAD;
  const eclipticLongitude = anomaly + center + 102.9372 * RAD + Math.PI;
  const transit = transitApprox + 0.0053 * Math.sin(anomaly) - 0.0069 * Math.sin(2 * eclipticLongitude);
  const declination = Math.asin(Math.sin(eclipticLongitude) * Math.sin(23.4397 * RAD));
  const cosHour = (Math.sin(-0.833 * RAD) - Math.sin(latitude * RAD) * Math.sin(declination)) / (Math.cos(latitude * RAD) * Math.cos(declination));
  if (cosHour < -1 || cosHour > 1) return null;
  const hour = Math.acos(cosHour) / (2 * Math.PI);
  return { sunrise: fromJulian(transit - hour), sunset: fromJulian(transit + hour) };
}
