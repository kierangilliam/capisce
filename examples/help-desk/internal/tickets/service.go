// Package tickets holds the tickets and the rules for working on them.
package tickets

import (
	"fmt"
	"sync"
	"time"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/notify"
)

// Service keeps every ticket in memory, behind one lock.
type Service struct {
	mu        sync.Mutex
	tickets   map[string]*Ticket
	lastID    int
	lastReply int
	directory *accounts.Directory
	outbox    *notify.Outbox
}

func NewService(directory *accounts.Directory, outbox *notify.Outbox) *Service {
	return &Service{tickets: map[string]*Ticket{}, lastID: 1000, directory: directory, outbox: outbox}
}

func (s *Service) addReply(ticket *Ticket, actor accounts.Actor, body string, internal bool, now time.Time) {
	s.lastReply++
	ticket.Replies = append(ticket.Replies, Reply{
		ID:               fmt.Sprintf("R-%d", s.lastReply),
		TicketID:         ticket.ID,
		AuthorCustomerID: actor.CustomerID,
		AuthorAgentID:    actor.AgentID,
		Body:             body,
		Internal:         internal,
		SentAt:           now,
	})
}

func (s *Service) planOf(ticket *Ticket) accounts.Plan {
	customer, err := s.directory.Customer(ticket.CustomerID)
	if err != nil {
		return accounts.PlanFree
	}
	return customer.Plan
}
