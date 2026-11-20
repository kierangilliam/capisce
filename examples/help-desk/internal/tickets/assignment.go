package tickets

import (
	"errors"
	"sort"
	"time"

	"example.com/helpdesk/internal/accounts"
)

var ErrAssigneeNotInTeam = errors.New("pick an active agent on the ticket's team")

// Assign gives a ticket to an agent. With no agent named, the caller
// takes it.
func (s *Service) Assign(actor accounts.Actor, id, toAgentID string, now time.Time) (Ticket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket, err := s.find(actor, id)
	if err != nil {
		return Ticket{}, err
	}
	if toAgentID == "" {
		toAgentID = actor.AgentID
	}
	if !CanAssign(actor, ticket, toAgentID) {
		return Ticket{}, accounts.ErrNotAllowed
	}
	if ticket.Status == StatusClosed {
		return Ticket{}, ErrTicketClosed
	}
	assignee, found := s.directory.Agent(toAgentID)
	if !found || !assignee.Active || assignee.TeamID != ticket.TeamID {
		return Ticket{}, ErrAssigneeNotInTeam
	}
	previous := ticket.AssignedAgentID
	if previous == toAgentID {
		return visibleTo(actor, ticket), nil
	}
	ticket.AssignedAgentID = toAgentID
	if ticket.Status == StatusNew {
		if err := s.move(ticket, StatusOpen, now); err != nil {
			return Ticket{}, err
		}
	}
	s.announceAssigned(ticket, previous, actor, now)
	return visibleTo(actor, ticket), nil
}

// ReleaseFrom takes every ticket that is not closed away from an agent
// who has left, and tells the team's leads. It returns the ticket ids.
func (s *Service) ReleaseFrom(agentID string, now time.Time) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	var released []string
	for _, ticket := range s.tickets {
		if ticket.AssignedAgentID != agentID || ticket.Status == StatusClosed {
			continue
		}
		ticket.AssignedAgentID = ""
		s.announceReleased(ticket, now)
		released = append(released, ticket.ID)
	}
	sort.Strings(released)
	return released
}
