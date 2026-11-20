package tickets

import (
	"errors"
	"strings"
	"time"

	"example.com/helpdesk/internal/accounts"
)

var ErrAlreadyEscalated = errors.New("this ticket is already escalated")

// Escalate is a lead saying a ticket needs more attention.
func (s *Service) Escalate(actor accounts.Actor, id, reason string, now time.Time) (Ticket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket, err := s.find(actor, id)
	if err != nil {
		return Ticket{}, err
	}
	if !CanEscalate(actor, ticket) {
		return Ticket{}, accounts.ErrNotAllowed
	}
	if ticket.Status == StatusClosed {
		return Ticket{}, ErrTicketClosed
	}
	if ticket.Escalated {
		return Ticket{}, ErrAlreadyEscalated
	}
	s.escalate(ticket, now)
	reason = strings.TrimSpace(reason)
	if reason != "" {
		s.addReply(ticket, actor, "Escalated: "+reason, true, now)
	}
	s.announceEscalated(ticket, actor, now)
	return visibleTo(actor, ticket), nil
}

// escalate marks a ticket escalated and raises its priority one step,
// which brings its deadline closer.
func (s *Service) escalate(ticket *Ticket, now time.Time) {
	ticket.Escalated = true
	ticket.Priority = ticket.Priority.Raised()
	s.retime(ticket, now)
}
