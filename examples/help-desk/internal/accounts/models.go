package accounts

import "time"

// Plan is what a customer pays for. It sets how fast we promise to reply.
type Plan string

const (
	PlanFree     Plan = "free"
	PlanStandard Plan = "standard"
	PlanPremium  Plan = "premium"
)

// Customer is a person who opens tickets.
type Customer struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Plan         Plan   `json:"plan"`
	PasswordHash string `json:"-"`
}

// Team is a group of agents that handles tickets about certain topics.
type Team struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Topics []string `json:"topics"`
	// CatchAll marks the team that gets tickets no other team handles.
	CatchAll bool `json:"catch_all"`
}

// Agent is a member of staff who answers tickets for one team.
type Agent struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	TeamID string `json:"team_id"`
	// Lead agents may reassign and escalate their team's tickets.
	Lead         bool   `json:"lead"`
	Active       bool   `json:"active"`
	PasswordHash string `json:"-"`
}

// Session is one sign-in. Exactly one of CustomerID and AgentID is set.
type Session struct {
	Token      string    `json:"token"`
	CustomerID string    `json:"customer_id,omitempty"`
	AgentID    string    `json:"agent_id,omitempty"`
	ExpiresAt  time.Time `json:"expires_at"`
}
