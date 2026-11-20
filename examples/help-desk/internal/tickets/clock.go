package tickets

import (
	"sort"
	"time"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/deadlines"
)

// startClock begins a customer's wait and sets when a reply is due.
func (s *Service) startClock(ticket *Ticket, now time.Time) {
	ticket.WaitingSince = now
	ticket.DueAt = deadlines.DueAt(now, ticket.Priority, s.planOf(ticket))
	ticket.Overdue = false
}

// stopClock ends the wait: we owe no reply, so nothing is due.
func stopClock(ticket *Ticket) {
	ticket.WaitingSince = time.Time{}
	ticket.DueAt = time.Time{}
	ticket.Overdue = false
}

// retime works the deadline out again after the priority or the plan
// changed. The wait still counts from when it began.
func (s *Service) retime(ticket *Ticket, now time.Time) {
	if ticket.DueAt.IsZero() {
		return
	}
	ticket.DueAt = deadlines.DueAt(ticket.WaitingSince, ticket.Priority, s.planOf(ticket))
	if now.Before(ticket.DueAt) {
		ticket.Overdue = false
	}
}

// RetimeForCustomer works out the deadlines of one customer's waiting
// tickets again, after their plan changed. It reports how many changed.
func (s *Service) RetimeForCustomer(customerID string, now time.Time) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	changed := 0
	for _, ticket := range s.tickets {
		if ticket.CustomerID != customerID || ticket.DueAt.IsZero() {
			continue
		}
		before := ticket.DueAt
		s.retime(ticket, now)
		if !ticket.DueAt.Equal(before) {
			changed++
		}
	}
	return changed
}

// MarkOverdue finds the tickets whose deadline has passed since the last
// look. Each is marked overdue, escalated if it was not already, and its
// team is told. It returns the ids of the tickets it marked.
func (s *Service) MarkOverdue(now time.Time) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	var marked []string
	for _, ticket := range s.tickets {
		if ticket.DueAt.IsZero() || ticket.Overdue || now.Before(ticket.DueAt) {
			continue
		}
		ticket.Overdue = true
		if !ticket.Escalated {
			s.escalate(ticket, now)
		}
		s.announceOverdue(ticket, now)
		marked = append(marked, ticket.ID)
	}
	sort.Strings(marked)
	return marked
}

// Overdue lists the tickets of an agent's team that are past their
// deadline right now, the longest overdue first.
func (s *Service) Overdue(actor accounts.Actor, now time.Time) ([]Ticket, error) {
	if !actor.IsAgent() {
		return nil, accounts.ErrNotAllowed
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	late := []Ticket{}
	for _, ticket := range s.tickets {
		if CanWorkOn(actor, ticket) && !ticket.DueAt.IsZero() && !now.Before(ticket.DueAt) {
			late = append(late, visibleTo(actor, ticket))
		}
	}
	sort.Slice(late, func(i, j int) bool { return late[i].DueAt.Before(late[j].DueAt) })
	return late, nil
}
