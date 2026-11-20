package tickets

import (
	"time"

	"example.com/helpdesk/internal/deadlines"
)

// Status is where a ticket stands.
type Status string

const (
	// StatusNew: opened, and no agent has taken it or replied yet.
	StatusNew Status = "new"
	// StatusOpen: the customer is waiting for us.
	StatusOpen Status = "open"
	// StatusWaiting: we replied and are waiting for the customer.
	StatusWaiting Status = "waiting"
	StatusClosed  Status = "closed"
)

// Ticket is one request for help from a customer, handled by one team.
type Ticket struct {
	ID              string             `json:"id"`
	CustomerID      string             `json:"customer_id"`
	TeamID          string             `json:"team_id"`
	AssignedAgentID string             `json:"assigned_agent_id,omitempty"`
	Subject         string             `json:"subject"`
	Topic           string             `json:"topic"`
	Priority        deadlines.Priority `json:"priority"`
	Status          Status             `json:"status"`
	Escalated       bool               `json:"escalated"`
	// Overdue is set when the deadline passed while the customer waited.
	Overdue  bool      `json:"overdue"`
	OpenedAt time.Time `json:"opened_at"`
	// WaitingSince and DueAt are zero while we owe the customer no reply.
	WaitingSince time.Time `json:"waiting_since"`
	DueAt        time.Time `json:"due_at"`
	ClosedAt     time.Time `json:"closed_at"`
	Replies      []Reply   `json:"replies"`
}

// Reply is one message on a ticket. Exactly one author field is set.
type Reply struct {
	ID               string `json:"id"`
	TicketID         string `json:"ticket_id"`
	AuthorCustomerID string `json:"author_customer_id,omitempty"`
	AuthorAgentID    string `json:"author_agent_id,omitempty"`
	Body             string `json:"body"`
	// Internal replies are notes between agents. Customers never see them.
	Internal bool      `json:"internal"`
	SentAt   time.Time `json:"sent_at"`
}
