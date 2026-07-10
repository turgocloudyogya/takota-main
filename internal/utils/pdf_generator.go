package utils

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// GeneratePDFFromHTML converts HTML to PDF using chromedp
func GeneratePDFFromHTML(ctx context.Context, htmlContent string) ([]byte, error) {
	// Create a new browser context with timeout
	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx,
		append(chromedp.DefaultExecAllocatorOptions[:],
			chromedp.Flag("headless", true),
			chromedp.Flag("disable-gpu", true),
			chromedp.Flag("no-sandbox", true),
			chromedp.Flag("disable-dev-shm-usage", true),
		)...,
	)
	defer allocCancel()

	// Create a new browser context
	browserCtx, browserCancel := chromedp.NewContext(allocCtx)
	defer browserCancel()

	// Set timeout
	timeoutCtx, timeoutCancel := context.WithTimeout(browserCtx, 30*time.Second)
	defer timeoutCancel()

	var pdfBuffer []byte

	// Navigate to data URL and generate PDF
	err := chromedp.Run(timeoutCtx,
		chromedp.Navigate("data:text/html,"+htmlContent),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBuffer, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithLandscape(true).
				WithPaperWidth(11.69).  // A4 landscape width in inches
				WithPaperHeight(8.27).  // A4 landscape height in inches
				WithMarginTop(0.87).    // 2.2cm in inches
				WithMarginBottom(0.39). // 1cm in inches
				WithMarginLeft(0.98).   // 2.5cm in inches
				WithMarginRight(0.39).  // 1cm in inches
				Do(ctx)
			return err
		}),
	)

	if err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}

	return pdfBuffer, nil
}

// RenderTemplate renders a Go template with data
func RenderTemplate(tmplPath string, funcMap template.FuncMap, data interface{}) (string, error) {
	tmpl, err := template.New("").Funcs(funcMap).ParseFiles(tmplPath)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, tmplPath[len("templates/"):], data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}
