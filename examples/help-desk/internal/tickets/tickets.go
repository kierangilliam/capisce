package tickets

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/deadlines"
)

var (
	ErrTicketNotFound     = errors.New("that ticket does not exist")
	ErrMissingText        = errors.New("write a subject and a message")
	ErrPriorityNotAllowed = errors.New("your plan does not include that priority")
	ErrTicketClosed       = errors.New("this ticket is closed; reopen it first")
	ErrReopenWindowPassed = errors.New("this ticket closed too long ago to reopen; open a new one")
)

// OpenInput is what someone fills in to open a ticket. CustomerID is
// only read when an agent opens a ticket for a customer.
type OpenInput struct {
	CustomerID string `json:"customer_id"`
	Subject    string `json:"subject"`
	Body       string `json:"body"`
	Topic      string `json:"topic"`
	Priority   string `json:"priority"`
}

// find returns a ticket the person may see. A ticket they may not see
// looks the same as one that does not exist.
func (s *Service) find(actor accounts.Actor, id string) (*Ticket, error) {
	ticket, found := s.tickets[id]
	if !found || !CanView(actor, ticket) {
		return nil, ErrTicketNotFound
	}
	return ticket, nil
}

// Open starts a ticket for a customer and routes it to a team.
func (s *Service) Open(actor accounts.Actor, in OpenInput, now time.Time) (Ticket, error) {
	customerID := actor.CustomerID
	if actor.IsAgent() {
		customerID = in.CustomerID
	}
	customer, err := s.directory.Customer(customerID)
	if err != nil {
		return Ticket{}, err
	}
	subject, body := strings.TrimSpace(in.Subject), strings.TrimSpace(in.Body)
	if subject == "" || body == "" {
		return Ticket{}, ErrMissingText
	}
	priority, err := deadlines.ParsePriority(in.Priority)
	if err != nil {
		return Ticket{}, err
	}
	if actor.IsCustomer() && priority.Above(deadlines.HighestFor(customer.Plan)) {
		return Ticket{}, ErrPriorityNotAllowed
	}
	topic := strings.ToLower(strings.TrimSpace(in.Topic))
	team := s.directory.TeamForTopic(topic)

	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastID++
	ticket := &Ticket{
		ID:         fmt.Sprintf("T-%d", s.lastID),
		CustomerID: customer.ID,
		TeamID:     team.ID,
		Subject:    subject,
		Topic:      topic,
		Priority:   priority,
		Status:     StatusNew,
		OpenedAt:   now,
	}
	s.addReply(ticket, actor, body, false, now)
	s.startClock(ticket, now)
	s.tickets[ticket.ID] = ticket
	s.announceOpened(ticket, actor, now)
	return visibleTo(actor, ticket), nil
}

// Get returns one ticket with its replies.
func (s *Service) Get(actor accounts.Actor, id string) (Ticket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket, err := s.find(actor, id)
	if err != nil {
		return Ticket{}, err
	}
	return visibleTo(actor, ticket), nil
}

// List returns the tickets a person may see, optionally of one status.
// Tickets with a deadline come first, the soonest on top; the rest
// follow, newest first.
func (s *Service) List(actor accounts.Actor, status Status) []Ticket {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := []Ticket{}
	for _, ticket := range s.tickets {
		if !CanView(actor, ticket) || (status != "" && ticket.Status != status) {
			continue
		}
		list = append(list, visibleTo(actor, ticket))
	}
	sort.Slice(list, func(i, j int) bool {
		a, b := list[i], list[j]
		if a.DueAt.IsZero() != b.DueAt.IsZero() {
			return !a.DueAt.IsZero()
		}
		if !a.DueAt.IsZero() && !a.DueAt.Equal(b.DueAt) {
			return a.DueAt.Before(b.DueAt)
		}
		return a.OpenedAt.After(b.OpenedAt)
	})
	return list
}

// Reply adds a message to a ticket. What it does to the ticket depends
// on who writes and where the ticket stands.
func (s *Service) Reply(actor accounts.Actor, id, body string, internal bool, now time.Time) (Ticket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket, err := s.find(actor, id)
	if err != nil {
		return Ticket{}, err
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return Ticket{}, ErrMissingText
	}
	switch {
	case actor.IsCustomer():
		err = s.customerReplies(ticket, internal, now)
	case !internal:
		err = s.agentReplies(ticket, actor, now)
	}
	if err != nil {
		return Ticket{}, err
	}
	s.addReply(ticket, actor, body, internal, now)
	s.announceReply(ticket, actor, internal, now)
	return visibleTo(actor, ticket), nil
}

// customerReplies brings a ticket back to us when the customer writes.
// A closed ticket reopens, but only within the reopen window.
func (s *Service) customerReplies(ticket *Ticket, internal bool, now time.Time) error {
	if internal {
		return accounts.ErrNotAllowed
	}
	switch ticket.Status {
	case StatusClosed:
		if now.Sub(ticket.ClosedAt) > ReopenWindow {
			return ErrReopenWindowPassed
		}
		return s.move(ticket, StatusOpen, now)
	case StatusWaiting:
		return s.move(ticket, StatusOpen, now)
	}
	return nil
}

// agentReplies answers the customer: the wait ends, and an agent who
// answers a ticket nobody has takes it.
func (s *Service) agentReplies(ticket *Ticket, actor accounts.Actor, now time.Time) error {
	if ticket.Status == StatusClosed {
		return ErrTicketClosed
	}
	if ticket.AssignedAgentID == "" {
		ticket.AssignedAgentID = actor.AgentID
	}
	if ticket.Status == StatusWaiting {
		return nil
	}
	return s.move(ticket, StatusWaiting, now)
}

// ChangePriority sets how urgent a ticket is and moves its deadline.
func (s *Service) ChangePriority(actor accounts.Actor, id, text string, now time.Time) (Ticket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket, err := s.find(actor, id)
	if err != nil {
		return Ticket{}, err
	}
	if !CanWorkOn(actor, ticket) {
		return Ticket{}, accounts.ErrNotAllowed
	}
	if ticket.Status == StatusClosed {
		return Ticket{}, ErrTicketClosed
	}
	priority, err := deadlines.ParsePriority(text)
	if err != nil {
		return Ticket{}, err
	}
	if priority == ticket.Priority {
		return visibleTo(actor, ticket), nil
	}
	ticket.Priority = priority
	s.retime(ticket, now)
	s.announcePriority(ticket, actor, now)
	return visibleTo(actor, ticket), nil
}

// Close ends a ticket. The customer or an agent on its team may close it.
func (s *Service) Close(actor accounts.Actor, id string, now time.Time) (Ticket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket, err := s.find(actor, id)
	if err != nil {
		return Ticket{}, err
	}
	if err := s.move(ticket, StatusClosed, now); err != nil {
		return Ticket{}, err
	}
	s.announceClosed(ticket, actor, now)
	return visibleTo(actor, ticket), nil
}

// Reopen brings a closed ticket back and starts a new deadline.
func (s *Service) Reopen(actor accounts.Actor, id string, now time.Time) (Ticket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket, err := s.find(actor, id)
	if err != nil {
		return Ticket{}, err
	}
	if ticket.Status != StatusClosed {
		return Ticket{}, ErrStatusChange
	}
	if !CanReopen(actor, ticket, now) {
		return Ticket{}, ErrReopenWindowPassed
	}
	if err := s.move(ticket, StatusOpen, now); err != nil {
		return Ticket{}, err
	}
	s.announceReopened(ticket, actor, now)
	return visibleTo(actor, ticket), nil
}
