package deadlines

import (
	"testing"
	"time"

	"example.com/helpdesk/internal/accounts"
)

func TestWindow(t *testing.T) {
	cases := []struct {
		priority Priority
		plan     accounts.Plan
		want     time.Duration
	}{
		{Urgent, accounts.PlanStandard, 1 * time.Hour},
		{Urgent, accounts.PlanPremium, 30 * time.Minute},
		{Urgent, accounts.PlanFree, 8 * time.Hour},
		{High, accounts.PlanFree, 8 * time.Hour},
		{Normal, accounts.PlanFree, 16 * time.Hour},
		{Low, accounts.PlanPremium, 12 * time.Hour},
	}
	for _, c := range cases {
		if got := Window(c.priority, c.plan); got != c.want {
			t.Errorf("Window(%s, %s) = %s, want %s", c.priority, c.plan, got, c.want)
		}
	}
}

func TestRaised(t *testing.T) {
	cases := map[Priority]Priority{Low: Normal, Normal: High, High: Urgent, Urgent: Urgent}
	for from, want := range cases {
		if got := from.Raised(); got != want {
			t.Errorf("%s.Raised() = %s, want %s", from, got, want)
		}
	}
}
