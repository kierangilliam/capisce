package notify

import "time"

// Kind says what a notice is about.
type Kind string

const (
	TicketOpened    Kind = "ticket_opened"
	NewReply        Kind = "new_reply"
	InternalNote    Kind = "internal_note"
	TicketAssigned  Kind = "ticket_assigned"
	TicketReleased  Kind = "ticket_released"
	PriorityChanged Kind = "priority_changed"
	TicketEscalated Kind = "ticket_escalated"
	TicketOverdue   Kind = "ticket_overdue"
	TicketClosed    Kind = "ticket_closed"
	TicketReopened  Kind = "ticket_reopened"
)

// Notice is one message to one person about a ticket. Exactly one of
// ToCustomerID and ToAgentID is set.
type Notice struct {
	ID           string    `json:"id"`
	ToCustomerID string    `json:"to_customer_id,omitempty"`
	ToAgentID    string    `json:"to_agent_id,omitempty"`
	TicketID     string    `json:"ticket_id"`
	Kind         Kind      `json:"kind"`
	Text         string    `json:"text"`
	SentAt       time.Time `json:"sent_at"`
	Read         bool      `json:"read"`
}
