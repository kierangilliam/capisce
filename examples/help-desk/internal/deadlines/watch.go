package deadlines

import (
	"context"
	"time"
)

// Watch calls sweep on every tick until the context ends. The app uses it
// to look for tickets that have passed their deadline.
func Watch(ctx context.Context, every time.Duration, sweep func(now time.Time)) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			sweep(now)
		}
	}
}
