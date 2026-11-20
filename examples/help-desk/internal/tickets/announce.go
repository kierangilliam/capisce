package tickets

import (
	"fmt"
	"time"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/notify"
)

// tellOwners tells the people responsible for a ticket: its assignee, or
// the team's active leads while nobody has it. The agent who caused the
// news is not told.
func (s *Service) tellOwners(ticket *Ticket, kind notify.Kind, text string, by accounts.Actor, now time.Time) {
	if ticket.AssignedAgentID != "" {
		s.tellAgent(ticket.AssignedAgentID, ticket, kind, text, by, now)
		return
	}
	s.tellLeads(ticket, kind, text, by, now)
}

func (s *Service) tellLeads(ticket *Ticket, kind notify.Kind, text string, by accounts.Actor, now time.Time) {
	for _, lead := range s.directory.LeadsOf(ticket.TeamID) {
		s.tellAgent(lead.ID, ticket, kind, text, by, now)
	}
}

func (s *Service) tellAgent(agentID string, ticket *Ticket, kind notify.Kind, text string, by accounts.Actor, now time.Time) {
	if agentID == "" || agentID == by.AgentID {
		return
	}
	s.outbox.Send(notify.ToAgent(agentID), kind, ticket.ID, text, now)
}

func (s *Service) tellCustomer(ticket *Ticket, kind notify.Kind, text string, now time.Time) {
	s.outbox.Send(notify.ToCustomer(ticket.CustomerID), kind, ticket.ID, text, now)
}

// tellOtherSide passes news across: what a customer did goes to the
// ticket's owners, what an agent did goes to the customer.
func (s *Service) tellOtherSide(ticket *Ticket, kind notify.Kind, text string, by accounts.Actor, now time.Time) {
	if by.IsCustomer() {
		s.tellOwners(ticket, kind, text, by, now)
		return
	}
	s.tellCustomer(ticket, kind, text, now)
}

func (s *Service) announceOpened(ticket *Ticket, by accounts.Actor, now time.Time) {
	s.tellLeads(ticket, notify.TicketOpened, fmt.Sprintf("New ticket %s: %s", ticket.ID, ticket.Subject), by, now)
	if by.IsAgent() {
		s.tellCustomer(ticket, notify.TicketOpened, fmt.Sprintf("We opened ticket %s for you: %s", ticket.ID, ticket.Subject), now)
	}
}

// announceReply: an internal note goes to the ticket's owners only. Any
// other reply goes to the other side.
func (s *Service) announceReply(ticket *Ticket, by accounts.Actor, internal bool, now time.Time) {
	if internal {
		s.tellOwners(ticket, notify.InternalNote, fmt.Sprintf("New note on ticket %s", ticket.ID), by, now)
		return
	}
	s.tellOtherSide(ticket, notify.NewReply, fmt.Sprintf("New reply on ticket %s", ticket.ID), by, now)
}

func (s *Service) announceAssigned(ticket *Ticket, previousAgentID string, by accounts.Actor, now time.Time) {
	s.tellAgent(ticket.AssignedAgentID, ticket, notify.TicketAssigned, fmt.Sprintf("Ticket %s is now yours", ticket.ID), by, now)
	s.tellAgent(previousAgentID, ticket, notify.TicketReleased, fmt.Sprintf("Ticket %s went to someone else", ticket.ID), by, now)
}

func (s *Service) announceReleased(ticket *Ticket, now time.Time) {
	s.tellLeads(ticket, notify.TicketReleased, fmt.Sprintf("Ticket %s needs a new owner", ticket.ID), accounts.Actor{}, now)
}

func (s *Service) announcePriority(ticket *Ticket, by accounts.Actor, now time.Time) {
	s.tellOwners(ticket, notify.PriorityChanged, fmt.Sprintf("Ticket %s is now %s priority", ticket.ID, ticket.Priority), by, now)
}

// announceEscalated tells the assignee and the customer. The lead who
// escalated already knows.
func (s *Service) announceEscalated(ticket *Ticket, by accounts.Actor, now time.Time) {
	s.tellAgent(ticket.AssignedAgentID, ticket, notify.TicketEscalated, fmt.Sprintf("Ticket %s was escalated", ticket.ID), by, now)
	s.tellCustomer(ticket, notify.TicketEscalated, fmt.Sprintf("Ticket %s is getting extra attention", ticket.ID), now)
}

// announceOverdue tells the team's leads and the assignee, never the
// customer.
func (s *Service) announceOverdue(ticket *Ticket, now time.Time) {
	text := fmt.Sprintf("Ticket %s is past its deadline", ticket.ID)
	s.tellLeads(ticket, notify.TicketOverdue, text, accounts.Actor{}, now)
	s.tellAgent(ticket.AssignedAgentID, ticket, notify.TicketOverdue, text, accounts.Actor{}, now)
}

func (s *Service) announceClosed(ticket *Ticket, by accounts.Actor, now time.Time) {
	s.tellOtherSide(ticket, notify.TicketClosed, fmt.Sprintf("Ticket %s was closed", ticket.ID), by, now)
}

func (s *Service) announceReopened(ticket *Ticket, by accounts.Actor, now time.Time) {
	s.tellOtherSide(ticket, notify.TicketReopened, fmt.Sprintf("Ticket %s was reopened", ticket.ID), by, now)
}
