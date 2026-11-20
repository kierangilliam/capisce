package deadlines

import (
	"time"

	"example.com/helpdesk/internal/accounts"
)

var baseWindow = map[Priority]time.Duration{
	Urgent: 1 * time.Hour,
	High:   4 * time.Hour,
	Normal: 8 * time.Hour,
	Low:    24 * time.Hour,
}

// shortestFreeWindow is the fastest reply promised on the free plan.
const shortestFreeWindow = 8 * time.Hour

// Window is how long a customer may wait for a reply. The priority sets
// the base. Premium customers wait half as long, free customers twice as
// long and never less than eight hours.
func Window(priority Priority, plan accounts.Plan) time.Duration {
	window := baseWindow[priority]
	switch plan {
	case accounts.PlanPremium:
		return window / 2
	case accounts.PlanFree:
		window *= 2
		if window < shortestFreeWindow {
			return shortestFreeWindow
		}
	}
	return window
}

// DueAt is when a reply is due for a customer waiting since waitingSince.
func DueAt(waitingSince time.Time, priority Priority, plan accounts.Plan) time.Time {
	return waitingSince.Add(Window(priority, plan))
}

// HighestFor is the most urgent priority a customer on a plan may pick
// for their own ticket. Agents may set any priority.
func HighestFor(plan accounts.Plan) Priority {
	if plan == accounts.PlanFree {
		return High
	}
	return Urgent
}
