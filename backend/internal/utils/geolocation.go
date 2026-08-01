package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	nominatimURL = "https://nominatim.openstreetmap.org/reverse"
	geoTimeout   = 10 * time.Second
)

// reverseGeocodeResponse is the JSON shape returned by Nominatim's reverse endpoint.
type reverseGeocodeResponse struct {
	DisplayName string `json:"display_name"`
	Error       string `json:"error,omitempty"`
}

// ReverseGeocode resolves a latitude/longitude pair to a human-readable
// address using the OpenStreetMap Nominatim reverse geocoding API. It returns
// nil when no address can be determined (bad coordinates or API error).
func ReverseGeocode(latitude, longitude string) (*string, error) {
	lat := strings.TrimSpace(latitude)
	lon := strings.TrimSpace(longitude)
	if lat == "" || lon == "" {
		return nil, nil
	}

	url := fmt.Sprintf("%s?format=json&lat=%s&lon=%s", nominatimURL, lat, lon)

	client := &http.Client{Timeout: geoTimeout}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "TakotaApp/1.0 (takota attendance app; reverse geocoding)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nominatim returned status %d", resp.StatusCode)
	}

	var result reverseGeocodeResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if result.Error != "" || strings.TrimSpace(result.DisplayName) == "" {
		return nil, nil
	}

	return &result.DisplayName, nil
}
