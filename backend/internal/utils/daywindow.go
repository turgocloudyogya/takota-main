package utils

import "time"

// StartOfToday returns midnight of the current day in the configured
// application timezone (TIMEZONE_APP). All "today" queries must derive
// from this, never from time.Now().UTC().Truncate(24h).
func StartOfToday() time.Time {
	now := Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

// TodayRange returns [start, end) covering the current app-timezone day.
// Pass start.UTC()/end.UTC() at the DB boundary; timestamptz compares in UTC
// but the instants are derived from the app timezone.
func TodayRange() (time.Time, time.Time) {
	start := StartOfToday()
	return start, start.AddDate(0, 0, 1)
}

// ParseDateInAppLocation parses YYYY-MM-DD in the app timezone.
func ParseDateInAppLocation(value string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", value, AppLocation())
}
